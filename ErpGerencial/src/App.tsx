import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErpProvider } from './context/ErpContext'
import LandingPage from './pages/LandingPage'
import StoreFormPage from './pages/StoreFormPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <ErpProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cadastrar-loja" element={<StoreFormPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErpProvider>
  )
}
