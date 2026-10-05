import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import InicioPage from './pages/inicio/InicioPage'
import LoginPage from './pages/login/login'
import CadastroPage from './pages/cadastro/CadastroPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
