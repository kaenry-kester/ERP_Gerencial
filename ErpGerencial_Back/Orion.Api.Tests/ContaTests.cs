using System.Net;
using System.Net.Http.Headers;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

[Collection("api")]
public class ContaTests(ApiDeTeste api)
{
    [Fact]
    public async Task Esqueci_minha_senha_troca_a_senha_e_ja_entra()
    {
        var conta = await api.NovaConta();
        var anonimo = api.CreateClient();

        var pedido = await anonimo.Post("/api/auth/senha/esqueci", new { email = conta.Email.ToUpperInvariant() });
        Assert.Equal(HttpStatusCode.OK, pedido.Status);
        var codigo = api.Emails.Codigo(conta.Email);
        Assert.Matches(@"^\d{6}$", codigo);

        var errado = await anonimo.Post("/api/auth/senha/redefinir",
            new { desafioId = pedido.Texto("desafioId"), codigo = codigo == "000000" ? "111111" : "000000", novaSenha = "Nova@Senha123" });
        Assert.Equal(HttpStatusCode.BadRequest, errado.Status);
        Assert.Contains("Restam 4", errado.Texto("erro"));

        var fraca = await anonimo.Post("/api/auth/senha/redefinir", new { desafioId = pedido.Texto("desafioId"), codigo, novaSenha = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, fraca.Status);

        var certo = await anonimo.Post("/api/auth/senha/redefinir", new { desafioId = pedido.Texto("desafioId"), codigo, novaSenha = "Nova@Senha123" });
        Assert.Equal(HttpStatusCode.OK, certo.Status);
        Assert.False(string.IsNullOrEmpty(certo.Texto("token")));

        // O mesmo código não vale duas vezes; a senha nova entra e a antiga não
        var deNovo = await anonimo.Post("/api/auth/senha/redefinir", new { desafioId = pedido.Texto("desafioId"), codigo, novaSenha = "Outra@Senha123" });
        Assert.Equal(HttpStatusCode.BadRequest, deNovo.Status);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.Post("/api/auth/login", new { email = conta.Email, senha = "Nova@Senha123" })).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.Post("/api/auth/login", new { email = conta.Email, senha = ContaDeTeste.Senha })).Status);
    }

    [Fact]
    public async Task Esqueci_minha_senha_nao_revela_se_o_email_existe()
    {
        var anonimo = api.CreateClient();
        var r = await anonimo.Post("/api/auth/senha/esqueci", new { email = "ninguem.mesmo@exemplo.com" });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.False(api.Emails.UltimoTexto.ContainsKey("ninguem.mesmo@exemplo.com"));
        var tentativa = await anonimo.Post("/api/auth/senha/redefinir", new { desafioId = r.Texto("desafioId"), codigo = "123456", novaSenha = "Nova@Senha123" });
        Assert.Equal(HttpStatusCode.BadRequest, tentativa.Status);
        Assert.Equal("Código incorreto.", tentativa.Texto("erro"));
    }

    [Fact]
    public async Task Renovar_devolve_uma_sessao_nova_que_funciona()
    {
        var conta = await api.NovaConta();
        var r = await conta.Http.Post("/api/auth/renovar");
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var novo = api.CreateClient();
        novo.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", r.Texto("token"));
        Assert.Equal(HttpStatusCode.OK, (await novo.Get("/api/auth/eu")).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.CreateClient().Post("/api/auth/renovar")).Status);
    }

    [Fact]
    public async Task Saude_diz_que_o_banco_esta_conectado()
    {
        var r = await api.CreateClient().Get("/api/saude");
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("conectado", r.Texto("banco"));
    }

    [Fact]
    public async Task Site_compilado_abre_em_qualquer_rota_do_app()
    {
        // Só quando o site foi compilado para dentro da API (npm run build:api)
        var indice = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Orion.Api", "wwwroot", "index.html");
        if (!File.Exists(indice)) return;
        var http = api.CreateClient();
        foreach (var rota in new[] { "/", "/app/produtos", "/app/cupom-fiscal/novo" })
        {
            var r = await http.GetAsync(rota);
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
            Assert.Contains("<div id=\"root\">", await r.Content.ReadAsStringAsync());
        }
    }

    [Fact]
    public async Task Rota_da_api_que_nao_existe_responde_404()
    {
        var r = await api.CreateClient().GetAsync("/api/nao-existe");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Funcionario_nao_vende_nem_ve_o_financeiro()
    {
        var admin = await api.NovaConta();
        var email = $"func.{Guid.NewGuid():N}@exemplo.com";
        var criado = await admin.Http.Post("/api/usuarios",
            new { nome = "Bruno Funcionário", email, telefone = "16988776655", senha = ContaDeTeste.Senha, administrador = false });
        Assert.Equal(HttpStatusCode.Created, criado.Status);

        var login = await api.CreateClient().Post("/api/auth/login", new { email, senha = ContaDeTeste.Senha });
        var funcionario = api.CreateClient();
        funcionario.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Texto("token"));
        Assert.Equal(HttpStatusCode.Forbidden, (await funcionario.Post("/api/cupons", new { itens = Array.Empty<object>(), valor = 10, formaPagamento = "pix", referente = "x" })).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await funcionario.Get("/api/financeiro/resumo")).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await funcionario.Get("/api/historico/clientes")).Status);
        Assert.Equal(HttpStatusCode.OK, (await funcionario.Get("/api/produtos")).Status);
    }

    [Fact]
    public async Task Administrador_define_uma_senha_nova_para_a_equipe()
    {
        var admin = await api.NovaConta();
        var email = $"func.{Guid.NewGuid():N}@exemplo.com";
        var criado = await admin.Http.Post("/api/usuarios",
            new { nome = "Carla", email, telefone = "16988776654", senha = ContaDeTeste.Senha, administrador = false });
        var id = criado.Texto("id");

        // Senha fraca é recusada; a boa passa a valer e a antiga deixa de funcionar
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.Http.Put($"/api/usuarios/{id}", new { nome = "Carla", telefone = "16988776654", administrador = false, ativo = true, novaSenha = "123" })).Status);
        Assert.Equal(HttpStatusCode.OK,
            (await admin.Http.Put($"/api/usuarios/{id}", new { nome = "Carla", telefone = "16988776654", administrador = false, ativo = true, novaSenha = "Nova@2026x" })).Status);
        Assert.Equal(HttpStatusCode.OK, (await api.CreateClient().Post("/api/auth/login", new { email, senha = "Nova@2026x" })).Status);
        Assert.NotEqual(HttpStatusCode.OK, (await api.CreateClient().Post("/api/auth/login", new { email, senha = ContaDeTeste.Senha })).Status);
    }
}
