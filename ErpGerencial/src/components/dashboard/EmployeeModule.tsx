import { useState } from 'react'
import { useErp } from '../../context/ErpContext'
import type { Role } from '../../types'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  birthDate: '',
  role: 'user' as Role,
}

export default function EmployeeModule() {
  const { addEmployee } = useErp()
  const [form, setForm] = useState(emptyForm)
  const [success, setSuccess] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addEmployee(form)
    setForm(emptyForm)
    setSuccess('Funcionário cadastrado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <article className="panel large-panel">
      <div className="panel-header">
        <h2>Cadastrar funcionário</h2>
      </div>

      {success && <div className="success-box">{success}</div>}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>Nome completo *</span>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </label>

        <label>
          <span>E-mail *</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
        </label>

        <label>
          <span>Senha *</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            minLength={6}
            required
          />
        </label>

        <label>
          <span>Telefone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="(11) 98765-4321"
          />
        </label>

        <label>
          <span>Data de nascimento</span>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))}
          />
        </label>

        <label>
          <span>Perfil *</span>
          <select
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
          >
            <option value="admin">Admin — cadastra e altera produtos e clientes</option>
            <option value="user">Usuário — apenas visualiza informações</option>
          </select>
        </label>

        <button type="submit" className="primary-button submit-button">
          Salvar funcionário
        </button>
      </form>
    </article>
  )
}
