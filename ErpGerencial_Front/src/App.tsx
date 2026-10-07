import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import InicioPage from './pages/inicio/InicioPage'
import LoginPage from './pages/login/login'
import CadastroPage from './pages/cadastro/CadastroPage'
import LojasPage from './pages/lojas/LojasPage'
import LojaCadastroPage from './pages/lojas/LojaCadastroPage'
import LojaLoginPage from './pages/lojas/LojaLoginPage'
import LojaLayout from './pages/loja/LojaLayout'
import LojaInicioPage from './pages/loja/LojaInicioPage'
import LojaModuloPage from './pages/loja/LojaModuloPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />

        {/* Conta: lista e cadastro das lojas */}
        <Route path="/lojas" element={<LojasPage />} />
        <Route path="/lojas/nova" element={<LojaCadastroPage />} />

        {/* Loja: acesso com CNPJ e senha e, dentro dela, o ERP (header, menu e módulos) */}
        <Route path="/loja/entrar" element={<LojaLoginPage />} />
        <Route path="/loja" element={<LojaLayout />}>
          <Route index element={<LojaInicioPage />} />
          <Route path=":modulo" element={<LojaModuloPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
