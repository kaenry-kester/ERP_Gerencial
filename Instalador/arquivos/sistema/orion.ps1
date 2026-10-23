<#
  Órion — programa da loja (pasta baixada e descompactada).
  Uso (pelos atalhos .bat da pasta): orion.ps1 iniciar | parar | restaurar | senha

  Estrutura:
    sistema\app        o Órion (site + API), sem precisar instalar .NET
    sistema\banco      PostgreSQL portátil
    sistema\whatsapp   Node portátil + Evolution (WhatsApp)
    dados\             criada na primeira vez: banco de dados, registros (logs) e config.json com as chaves
  As cópias de segurança vão para uma pasta do Google Drive ou OneDrive (detectada na primeira vez).
#>
param([Parameter(Mandatory = $true)][ValidateSet('iniciar', 'parar', 'restaurar', 'senha')][string]$acao)

$ErrorActionPreference = 'Stop'
$sistema = Split-Path -Parent $MyInvocation.MyCommand.Path
$raiz = Split-Path -Parent $sistema
$dados = Join-Path $raiz 'dados'
$logs = Join-Path $dados 'registros'
$arquivoConfig = Join-Path $dados 'config.json'
$pgBin = Join-Path $sistema 'banco\bin'
$pastaBanco = Join-Path $dados 'banco'
$node = Join-Path $sistema 'whatsapp\node.exe'
$evolution = Join-Path $sistema 'whatsapp\evolution'
$api = Join-Path $sistema 'app\Orion.Api.exe'

function Escrever([string]$texto, [string]$cor = 'Gray') { Write-Host $texto -ForegroundColor $cor }

# Programas externos (PostgreSQL, Node) escrevem avisos no canal de erro; o que vale é o código de saída
function Nativo([scriptblock]$bloco) {
  $antes = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $bloco } finally { $ErrorActionPreference = $antes }
}

# Abre o navegador (ORION_SEM_NAVEGADOR=1 desliga, só para testes)
function AbrirNavegador([string]$endereco) { if (-not $env:ORION_SEM_NAVEGADOR) { Start-Process $endereco } }

function NovaChave([int]$bytes = 32) {
  $gerador = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $b = New-Object byte[] $bytes
  $gerador.GetBytes($b)
  -join ($b | ForEach-Object { $_.ToString('x2') })
}

# Pasta das cópias: Google Drive ("Meu Drive"), senão OneDrive, senão Documentos (sem nuvem: avisa)
function PastaDasCopias {
  if ($env:ORION_PASTA_BACKUP) { return $env:ORION_PASTA_BACKUP }
  foreach ($disco in (Get-PSDrive -PSProvider FileSystem)) {
    foreach ($nome in 'Meu Drive', 'My Drive') {
      $caminho = Join-Path $disco.Root $nome
      if (Test-Path $caminho) { return (Join-Path $caminho 'Orion-Copias') }
    }
  }
  if ($env:OneDrive -and (Test-Path $env:OneDrive)) { return (Join-Path $env:OneDrive 'Orion-Copias') }
  return (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Orion-Copias')
}

function LerConfig { Get-Content $arquivoConfig -Raw -Encoding UTF8 | ConvertFrom-Json }

function SalvarConfig($config) {
  $config | ConvertTo-Json | Set-Content -Path $arquivoConfig -Encoding UTF8
}

function ApiNoAr($config) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$($config.portaApi)/api/saude"
    return $r.StatusCode -eq 200
  } catch { return $false }
}

function BancoLigado {
  Nativo { & (Join-Path $pgBin 'pg_ctl.exe') status -D $pastaBanco *> $null }
  return $LASTEXITCODE -eq 0
}

function LigarBanco($config) {
  if (BancoLigado) { return }
  Escrever 'Ligando o banco de dados...'
  # Processo separado e escondido: o banco continua ligado sem prender esta janela
  $p = Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -WindowStyle Hidden -PassThru `
    -ArgumentList @('start', '-D', "`"$pastaBanco`"", '-l', "`"$(Join-Path $logs 'banco.log')`"", '-o', "`"-p $($config.portaBanco)`"", '-w', '-t', '60')
  [void]$p.WaitForExit(90000)
  for ($i = 0; $i -lt 30 -and -not (BancoLigado); $i++) { Start-Sleep -Seconds 1 }
  if (-not (BancoLigado)) { throw "O banco de dados não ligou. Veja $logs\banco.log" }
}

function Psql($config, [string]$banco, [string]$comando) {
  $env:PGPASSWORD = $config.senhaBanco
  Nativo { & (Join-Path $pgBin 'psql.exe') -h localhost -p $config.portaBanco -U postgres -d $banco -tAc $comando 2>&1 }
}

# ---------- Primeira vez: chaves, banco de dados e configuração do WhatsApp ----------
function PrimeiraVez {
  New-Item -ItemType Directory -Force -Path $dados, $logs | Out-Null
  if (Test-Path $arquivoConfig) { return }
  Escrever 'Primeira vez: preparando o Órion (leva cerca de 1 minuto)...' 'Cyan'
  $config = [pscustomobject]@{
    senhaBanco      = NovaChave 16
    chaveJwt        = NovaChave 32
    chaveWhatsapp   = NovaChave 16
    pastaCopias     = PastaDasCopias
    portaApi        = 5000
    portaBanco      = 5433
    portaWhatsapp   = 8090
    whatsappPronto  = $false
  }

  # Banco de dados novo (só aceita conexões deste computador)
  $senhaArquivo = Join-Path $dados 'senha.tmp'
  Set-Content -Path $senhaArquivo -Value $config.senhaBanco -NoNewline -Encoding ASCII
  Nativo { & (Join-Path $pgBin 'initdb.exe') -D $pastaBanco -U postgres --pwfile=$senhaArquivo -A scram-sha-256 -E UTF8 --locale=C *> (Join-Path $logs 'initdb.log') }
  Remove-Item $senhaArquivo -Force
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível criar o banco de dados. Veja $logs\initdb.log" }
  Add-Content -Path (Join-Path $pastaBanco 'postgresql.conf') -Value "`nlisten_addresses = 'localhost'`nport = $($config.portaBanco)`n"
  SalvarConfig $config

  LigarBanco $config
  Psql $config 'postgres' 'CREATE DATABASE orion' | Out-Null
  Psql $config 'postgres' 'CREATE DATABASE evolution' | Out-Null
  New-Item -ItemType Directory -Force -Path $config.pastaCopias | Out-Null
  Escrever "Cópias de segurança: $($config.pastaCopias)" 'Green'
}

function PrepararWhatsapp($config) {
  # Configuração da Evolution (WhatsApp): porta própria, banco "evolution" e a chave desta instalação
  $uri = "postgresql://postgres:$($config.senhaBanco)@localhost:$($config.portaBanco)/evolution?schema=public"
  @"
SERVER_TYPE=http
SERVER_PORT=$($config.portaWhatsapp)
SERVER_URL=http://localhost:$($config.portaWhatsapp)
TELEMETRY_ENABLED=false
CORS_ORIGIN=*
LOG_LEVEL=ERROR,WARN
LOG_COLOR=false
LOG_BAILEYS=error
DEL_INSTANCE=false
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=$uri
DATABASE_CONNECTION_CLIENT_NAME=orion
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_LABELS=false
DATABASE_SAVE_DATA_HISTORIC=false
DATABASE_SAVE_IS_ON_WHATSAPP=true
DATABASE_SAVE_IS_ON_WHATSAPP_DAYS=7
RABBITMQ_ENABLED=false
SQS_ENABLED=false
WEBSOCKET_ENABLED=false
CONFIG_SESSION_PHONE_CLIENT=Orion
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
AUTHENTICATION_API_KEY=$($config.chaveWhatsapp)
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
LANGUAGE=pt-BR
"@ | Set-Content -Path (Join-Path $evolution '.env') -Encoding ASCII

  if ($config.whatsappPronto) { return }
  Escrever 'Preparando o WhatsApp (só na primeira vez)...'
  $migracoes = Join-Path $evolution 'prisma\migrations'
  if (-not (Test-Path $migracoes)) { Copy-Item (Join-Path $evolution 'prisma\postgresql-migrations') $migracoes -Recurse }
  $env:DATABASE_CONNECTION_URI = $uri
  Push-Location $evolution
  try {
    Nativo { & $node 'node_modules\prisma\build\index.js' migrate deploy --schema 'prisma\postgresql-schema.prisma' *> (Join-Path $logs 'whatsapp-preparo.log') }
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar o WhatsApp. Veja $logs\whatsapp-preparo.log" }
  } finally { Pop-Location }
  $config.whatsappPronto = $true
  SalvarConfig $config
}

function VariaveisDoSistema($config) {
  # Passadas ao Órion (API): banco, chaves, WhatsApp e cópias de segurança
  $env:ASPNETCORE_ENVIRONMENT = 'Production'
  $env:ASPNETCORE_URLS = "http://0.0.0.0:$($config.portaApi)"
  $env:ConnectionStrings__Orion = "Host=localhost;Port=$($config.portaBanco);Database=orion;Username=postgres;Password=$($config.senhaBanco)"
  $env:Jwt__Chave = $config.chaveJwt
  $env:Evolution__Url = "http://localhost:$($config.portaWhatsapp)"
  $env:Evolution__Chave = $config.chaveWhatsapp
  $env:Backup__Pasta = $config.pastaCopias
  $env:Backup__PgDump = Join-Path $pgBin 'pg_dump.exe'
  $env:Backup__IntervaloMinutos = '60'
  $env:Backup__AoFechar = 'true'
  $env:Https__Ativo = 'false'
  $env:Sistema__PermitirDesligar = 'true'
}

function Processo([string]$arquivoPid) {
  $caminho = Join-Path $dados $arquivoPid
  if (-not (Test-Path $caminho)) { return $null }
  $id = [int](Get-Content $caminho)
  return Get-Process -Id $id -ErrorAction SilentlyContinue
}

function Iniciar {
  PrimeiraVez
  $config = LerConfig
  LigarBanco $config
  if (ApiNoAr $config) {
    Escrever 'O Órion já está aberto.' 'Green'
    AbrirNavegador "http://localhost:$($config.portaApi)"
    return
  }
  PrepararWhatsapp $config

  if (-not (Processo 'whatsapp.pid')) {
    Escrever 'Ligando o WhatsApp...'
    $p = Start-Process -FilePath $node -ArgumentList 'dist/main' -WorkingDirectory $evolution -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logs 'whatsapp.log') -RedirectStandardError (Join-Path $logs 'whatsapp-erros.log')
    Set-Content (Join-Path $dados 'whatsapp.pid') $p.Id
  }

  Escrever 'Abrindo o Órion...'
  VariaveisDoSistema $config
  $p = Start-Process -FilePath $api -WorkingDirectory (Split-Path $api) -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logs 'orion.log') -RedirectStandardError (Join-Path $logs 'orion-erros.log')
  Set-Content (Join-Path $dados 'orion.pid') $p.Id

  for ($i = 0; $i -lt 90; $i++) {
    if (ApiNoAr $config) {
      Escrever 'Pronto! O Órion está aberto no navegador.' 'Green'
      # Endereço na rede da loja: a placa que tem saída para a internet (ignora redes virtuais/VPN)
      $ip = (Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and
          ($_.InterfaceDescription + ' ' + $_.InterfaceAlias) -notmatch 'VPN|Virtual|Radmin|Hamachi|VMware|Hyper-V|TAP|Tunnel|ZeroTier|Tailscale' } |
        Select-Object -First 1).IPv4Address.IPAddress
      if ($ip) { Escrever "Outros computadores e celulares do mesmo Wi-Fi: http://${ip}:$($config.portaApi)" }
      AbrirNavegador "http://localhost:$($config.portaApi)"
      return
    }
    if ($p.HasExited) { throw "O Órion fechou ao abrir. Veja $logs\orion-erros.log" }
    Start-Sleep -Seconds 1
  }
  throw "O Órion demorou demais para abrir. Veja $logs\orion.log"
}

function Parar {
  if (-not (Test-Path $arquivoConfig)) { Escrever 'O Órion ainda não foi aberto nenhuma vez.'; return }
  $config = LerConfig
  $orion = Processo 'orion.pid'
  if ($orion) {
    Escrever 'Fechando o Órion (fazendo a última cópia de segurança)...'
    try { Invoke-WebRequest -UseBasicParsing -Method Post -TimeoutSec 5 "http://localhost:$($config.portaApi)/api/sistema/desligar" | Out-Null } catch {}
    if (-not $orion.WaitForExit(180000)) { Stop-Process -Id $orion.Id -Force }
  }
  $whatsapp = Processo 'whatsapp.pid'
  if ($whatsapp) { Escrever 'Fechando o WhatsApp...'; Stop-Process -Id $whatsapp.Id -Force }
  Remove-Item (Join-Path $dados '*.pid') -ErrorAction SilentlyContinue
  if (BancoLigado) {
    Escrever 'Desligando o banco de dados...'
    & (Join-Path $pgBin 'pg_ctl.exe') stop -D $pastaBanco -m fast -w | Out-Null
  }
  Escrever 'O Órion foi fechado. Seus dados estão salvos.' 'Green'
}

function Restaurar {
  if (-not (Test-Path $arquivoConfig)) { PrimeiraVez }
  $config = LerConfig
  $pasta = $config.pastaCopias
  $copias = @(Get-ChildItem -Path $pasta -Filter 'orion-*.dump' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 30)
  if ($copias.Count -eq 0) {
    Escrever "Nenhuma cópia encontrada em: $pasta" 'Yellow'
    $outra = Read-Host 'Digite o caminho da pasta das cópias (ou Enter para sair)'
    if (-not $outra) { return }
    $copias = @(Get-ChildItem -Path $outra -Filter 'orion-*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 30)
    if ($copias.Count -eq 0) { Escrever 'Nenhuma cópia nessa pasta.' 'Yellow'; return }
  }
  Escrever "`nCópias de segurança (a 1 é a mais recente):" 'Cyan'
  for ($i = 0; $i -lt $copias.Count; $i++) {
    Escrever ("  {0,2}) {1:dd/MM/yyyy HH:mm}   {2:N1} MB" -f ($i + 1), $copias[$i].LastWriteTime, ($copias[$i].Length / 1MB))
  }
  $escolha = Read-Host "`nNúmero da cópia para restaurar (Enter cancela)"
  if (-not $escolha) { return }
  $copia = $copias[[int]$escolha - 1]
  Escrever "`nATENÇÃO: os dados atuais do Órion serão trocados pelos da cópia de $($copia.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))." 'Yellow'
  if ((Read-Host 'Digite SIM para continuar') -ne 'SIM') { Escrever 'Cancelado.'; return }

  Parar
  LigarBanco $config
  Escrever 'Restaurando...'
  $env:PGPASSWORD = $config.senhaBanco
  Nativo { & (Join-Path $pgBin 'pg_restore.exe') --clean --if-exists --no-owner -h localhost -p $config.portaBanco -U postgres -d orion $copia.FullName *> (Join-Path $logs 'restaurar.log') }
  Escrever 'Cópia restaurada! Abrindo o Órion...' 'Green'
  Iniciar
}

# "Esqueci a senha": troca a senha de uma conta pelo próprio computador da loja (não há e-mail de recuperação)
function TrocarSenha {
  Iniciar
  $config = LerConfig
  Escrever "`nTrocar a senha de uma conta do Órion" 'Cyan'
  $email = Read-Host 'E-mail da conta'
  Escrever 'A senha nova precisa de 8 letras ou mais, com uma maiúscula, um número e um símbolo (ex.: Loja@2026).'
  $segura = Read-Host 'Senha nova' -AsSecureString
  $senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))
  $corpo = @{ email = $email; novaSenha = $senha } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) "http://localhost:$($config.portaApi)/api/sistema/redefinir-senha"
    Escrever "Senha trocada! $($r.nome) já pode entrar com a senha nova." 'Green'
  } catch {
    $codigo = $_.Exception.Response.StatusCode.value__
    if ($codigo -eq 404) { Escrever 'Não existe conta com este e-mail.' 'Yellow' }
    elseif ($codigo -eq 400) { Escrever 'A senha nova não tem todos os requisitos. Tente de novo.' 'Yellow' }
    else { throw }
  }
}

try {
  switch ($acao) {
    'iniciar' { Iniciar }
    'parar' { Parar }
    'restaurar' { Restaurar }
    'senha' { TrocarSenha }
  }
} catch {
  Escrever "`nNão deu certo: $($_.Exception.Message)" 'Red'
  exit 1
}
