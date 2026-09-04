import { useNavigate } from 'react-router-dom'
import { useErp } from '../../context/ErpContext'
import type { Role } from '../../types'
import './header.css'

type Props = {
  storeName: string
  userName: string
  role: Role
}

export default function Header({ storeName, userName, role }: Props) {
  const navigate = useNavigate()
  const { logout } = useErp()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="app-header">
      <div className="brand-area">
        <span className="brand-badge">ERP</span>
        <div>
          <p className="brand-name">{storeName || 'Gerencial'}</p>
          <small>Controle operacional</small>
        </div>
      </div>

      <nav className="main-nav" aria-label="Menu principal">
        <span className="nav-user">{userName}</span>
      </nav>

      <div className="header-actions">
        <button type="button" className="user-chip">
          {role === 'admin' ? 'Admin' : 'Usuário'}
        </button>
        <button type="button" className="ghost-button small-button" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </header>
  )
}
