import { useState } from 'react'
import { useErp } from '../../context/ErpContext'

const emptyForm = { name: '', email: '', phone: '', city: '', cpf: '' }

type Props = { mode: 'create' | 'view' }

export default function ClientModule({ mode }: Props) {
  const { clients, addClient, updateClient, deleteClient, currentUser } = useErp()
  const [form, setForm] = useState(emptyForm)
  const [success, setSuccess] = useState('')

  const isAdmin = currentUser?.role === 'admin'

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAdmin) return

    addClient(form)
    setForm(emptyForm)
    setSuccess('Cliente cadastrado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  if (mode === 'create') {
    return (
      <article className="panel large-panel">
        <div className="panel-header">
          <h2>Cadastrar cliente</h2>
        </div>

        {isAdmin ? (
          <>
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
                <span>CPF</span>
                <input
                  value={form.cpf}
                  onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </label>

              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
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
                <span>Cidade</span>
                <input
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                />
              </label>

              <button type="submit" className="primary-button submit-button">
                Cadastrar cliente
              </button>
            </form>
          </>
        ) : (
          <div className="access-warning">
            <p>Seu perfil de <strong>usuário</strong> tem permissão apenas para visualizar clientes.</p>
            <p className="hint">Use "Visualizar cliente" para consultar a lista de clientes.</p>
          </div>
        )}
      </article>
    )
  }

  return (
    <article className="panel large-panel">
      <div className="panel-header">
        <h2>Visualizar clientes</h2>
        {!isAdmin && <span className="view-only-badge">Somente visualização</span>}
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum cliente cadastrado ainda.</p>
          {isAdmin && <p className="hint">Use "Cadastrar cliente" para adicionar clientes.</p>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Cidade</th>
                {isAdmin && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    {isAdmin ? (
                      <input
                        value={client.name}
                        onChange={(e) => updateClient(client.id, 'name', e.target.value)}
                      />
                    ) : (
                      client.name
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        value={client.cpf}
                        onChange={(e) => updateClient(client.id, 'cpf', e.target.value)}
                      />
                    ) : (
                      client.cpf || '—'
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        value={client.email}
                        onChange={(e) => updateClient(client.id, 'email', e.target.value)}
                      />
                    ) : (
                      client.email || '—'
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        value={client.phone}
                        onChange={(e) => updateClient(client.id, 'phone', e.target.value)}
                      />
                    ) : (
                      client.phone || '—'
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        value={client.city}
                        onChange={(e) => updateClient(client.id, 'city', e.target.value)}
                      />
                    ) : (
                      client.city || '—'
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deleteClient(client.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
