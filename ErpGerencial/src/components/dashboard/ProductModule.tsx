import { useState } from 'react'
import { useErp } from '../../context/ErpContext'

const emptyForm = { name: '', category: '', price: '', stock: '', sku: '' }

type Props = { mode: 'create' | 'manage' }

export default function ProductModule({ mode }: Props) {
  const { products, addProduct, updateProduct, deleteProduct, currentUser } = useErp()
  const [form, setForm] = useState(emptyForm)
  const [success, setSuccess] = useState('')

  const isAdmin = currentUser?.role === 'admin'

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAdmin) return

    addProduct({
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      sku: form.sku,
    })
    setForm(emptyForm)
    setSuccess('Produto cadastrado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  if (mode === 'create') {
    return (
      <article className="panel large-panel">
        <div className="panel-header">
          <h2>Cadastrar produto</h2>
        </div>

        {isAdmin ? (
          <>
            {success && <div className="success-box">{success}</div>}
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                <span>Nome do produto *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Código SKU</span>
                <input
                  value={form.sku}
                  onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                  placeholder="Ex: PROD-001"
                />
              </label>

              <label>
                <span>Categoria *</span>
                <input
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Preço (R$) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Estoque *</span>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                  required
                />
              </label>

              <button type="submit" className="primary-button submit-button">
                Cadastrar produto
              </button>
            </form>
          </>
        ) : (
          <div className="access-warning">
            <p>Seu perfil é de <strong>usuário</strong> e não possui permissão para cadastrar produtos.</p>
            <p className="hint">Apenas administradores podem cadastrar e alterar produtos.</p>
          </div>
        )}
      </article>
    )
  }

  return (
    <article className="panel large-panel">
      <div className="panel-header">
        <h2>Gerenciar produtos</h2>
        {!isAdmin && <span className="view-only-badge">Somente visualização</span>}
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum produto cadastrado ainda.</p>
          {isAdmin && <p className="hint">Use "Cadastrar produto" para adicionar itens ao estoque.</p>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>SKU</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Estoque</th>
                {isAdmin && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    {isAdmin ? (
                      <input
                        value={product.name}
                        onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                      />
                    ) : (
                      product.name
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        value={product.sku}
                        onChange={(e) => updateProduct(product.id, 'sku', e.target.value)}
                      />
                    ) : (
                      product.sku || '—'
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        value={product.category}
                        onChange={(e) => updateProduct(product.id, 'category', e.target.value)}
                      />
                    ) : (
                      product.category
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        type="number"
                        step="0.01"
                        value={product.price}
                        onChange={(e) => updateProduct(product.id, 'price', Number(e.target.value))}
                      />
                    ) : (
                      `R$ ${product.price.toFixed(2)}`
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input
                        type="number"
                        value={product.stock}
                        onChange={(e) => updateProduct(product.id, 'stock', Number(e.target.value))}
                      />
                    ) : (
                      product.stock
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deleteProduct(product.id)}
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
