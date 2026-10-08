import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import InicioPage from './pages/inicio/InicioPage'
import LoginPage from './pages/login/login'
import CadastroPage from './pages/cadastro/CadastroPage'
import ErpLayout from './pages/erp/ErpLayout'
import ErpInicioPage from './pages/erp/InicioPage'
import EmpresaPage from './pages/erp/EmpresaPage'
import UsuariosPage from './pages/erp/UsuariosPage'
import UsuarioFormPage from './pages/erp/UsuarioFormPage'
import ModuloPage from './pages/erp/ModuloPage'
import ContaPage from './pages/erp/ContaPage'
import ProdutosPage from './pages/erp/produtos/ProdutosPage'
import ProdutoFormPage from './pages/erp/produtos/ProdutoFormPage'
import ProdutoPage from './pages/erp/produtos/ProdutoPage'
import ClientesPage from './pages/erp/clientes/ClientesPage'
import ClienteFormPage from './pages/erp/clientes/ClienteFormPage'
import ClientePage from './pages/erp/clientes/ClientePage'
import MensagemAutomaticaPage from './pages/erp/clientes/MensagemAutomaticaPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />

        {/* ERP da empresa: tela inicial com os botões grandes e as páginas dos módulos */}
        <Route path="/app" element={<ErpLayout />}>
          <Route index element={<ErpInicioPage />} />
          <Route path="conta" element={<ContaPage />} />
          <Route path="empresa" element={<EmpresaPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="usuarios/novo" element={<UsuarioFormPage />} />
          <Route path="usuarios/:id" element={<UsuarioFormPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="produtos/novo" element={<ProdutoFormPage />} />
          <Route path="produtos/:id" element={<ProdutoPage />} />
          <Route path="produtos/:id/editar" element={<ProdutoFormPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/novo" element={<ClienteFormPage />} />
          <Route path="clientes/mensagem" element={<MensagemAutomaticaPage />} />
          <Route path="clientes/:id" element={<ClientePage />} />
          <Route path="clientes/:id/editar" element={<ClienteFormPage />} />
          <Route path=":modulo" element={<ModuloPage />} />
        </Route>

        {/* Endereços das versões com lojas */}
        <Route path="/loja/*" element={<Navigate to="/app" replace />} />
        <Route path="/lojas/*" element={<Navigate to="/app" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
