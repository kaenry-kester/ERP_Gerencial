<#
  Monta o programa da loja (pasta + Orion.zip) a partir do projeto.
  Uso (na pasta Instalador):  powershell -ExecutionPolicy Bypass -File montar-pacote.ps1

  Junta:
    - o site compilado dentro da API e a API publicada para Windows (sem precisar instalar .NET);
    - o PostgreSQL deste computador (bin, lib, share) como banco portátil;
    - o Node deste computador e a Evolution (WhatsApp), SEM sessões conectadas (pasta instances) e sem o .env;
    - os atalhos e o LEIA-ME (pasta arquivos).
  Resultado: ..\pacote\Orion (pasta) e ..\pacote\Orion.zip
#>
param(
  [string]$PostgreSql = '',
  [string]$Node = ''
)
$ErrorActionPreference = 'Stop'
$instalador = Split-Path -Parent $MyInvocation.MyCommand.Path
$projeto = Split-Path -Parent $instalador
$saida = Join-Path $projeto 'pacote'
$pasta = Join-Path $saida 'Orion'
$sistema = Join-Path $pasta 'sistema'

function Passo([string]$texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }

function Copiar([string]$de, [string]$para, [string[]]$semPastas = @(), [string[]]$semArquivos = @()) {
  $argumentos = @($de, $para, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1')
  if ($semPastas.Count) { $argumentos += '/XD'; $argumentos += $semPastas }
  if ($semArquivos.Count) { $argumentos += '/XF'; $argumentos += $semArquivos }
  & robocopy @argumentos | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar $de" }
}

# PostgreSQL e Node deste computador (ou os informados)
if (-not $PostgreSql) {
  $PostgreSql = Get-PSDrive -PSProvider FileSystem | ForEach-Object { Join-Path $_.Root 'Program Files\PostgreSQL' } |
    Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Directory } |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\initdb.exe') } |
    Sort-Object { [int]($_.Name -replace '\D', '') } -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $PostgreSql) { throw 'PostgreSQL não encontrado. Informe -PostgreSql "C:\Program Files\PostgreSQL\18"' }
if (-not $Node) { $Node = (Get-Command node.exe).Source }
Write-Host "PostgreSQL: $PostgreSql`nNode: $Node"

Passo 'Limpando o pacote anterior'
if (Test-Path $pasta) { Remove-Item $pasta -Recurse -Force }
New-Item -ItemType Directory -Force -Path $sistema | Out-Null

Passo 'Compilando o site para dentro da API'
Push-Location (Join-Path $projeto 'ErpGerencial_Front')
try {
  & npm run build:api
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o site' }
} finally { Pop-Location }

Passo 'Publicando o Órion para Windows'
& dotnet publish (Join-Path $projeto 'ErpGerencial_Back\Orion.Api') -c Release -r win-x64 --self-contained true -o (Join-Path $sistema 'app') --nologo
if ($LASTEXITCODE -ne 0) { throw 'Falha ao publicar a API' }
Remove-Item (Join-Path $sistema 'app\appsettings.Development.json') -ErrorAction SilentlyContinue

Passo 'Copiando o banco de dados portátil (PostgreSQL)'
foreach ($parte in 'bin', 'lib', 'share') {
  Copiar (Join-Path $PostgreSql $parte) (Join-Path $sistema "banco\$parte") -semPastas @('pgAdmin 4', 'doc')
}

Passo 'Copiando o WhatsApp (Node + Evolution)'
$whatsapp = Join-Path $sistema 'whatsapp'
New-Item -ItemType Directory -Force -Path $whatsapp | Out-Null
Copy-Item $Node (Join-Path $whatsapp 'node.exe')
$evolution = Join-Path $projeto 'ErpGerencial_Automacao\evolution-api'
Copiar $evolution (Join-Path $whatsapp 'evolution') `
  -semPastas @((Join-Path $evolution 'instances'), (Join-Path $evolution 'src'), (Join-Path $evolution 'Docker'),
    (Join-Path $evolution 'evolution-manager-v2'), (Join-Path $evolution 'Extras'), (Join-Path $evolution '.git'),
    (Join-Path $evolution 'prisma\migrations')) `
  -semArquivos @('.env', '*.map', 'docker-compose*.yaml', 'Dockerfile*')
New-Item -ItemType Directory -Force -Path (Join-Path $whatsapp 'evolution\instances') | Out-Null

Passo 'Copiando os atalhos e o LEIA-ME'
Copiar (Join-Path $instalador 'arquivos') $pasta

Passo 'Compactando (Orion.zip)'
$zip = Join-Path $saida 'Orion.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($pasta, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true)

$tamanhoPasta = (Get-ChildItem $pasta -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
$tamanhoZip = (Get-Item $zip).Length / 1MB
Write-Host ("`nPronto!`n  Pasta: {0} ({1:N0} MB)`n  Zip:   {2} ({3:N0} MB)" -f $pasta, $tamanhoPasta, $zip, $tamanhoZip) -ForegroundColor Green
