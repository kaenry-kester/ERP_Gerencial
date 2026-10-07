import { useState } from 'react'
import { useErp } from '../../context/ErpContext'

export default function FinanceModule() {
  const { clients, products } = useErp()
  const [message, setMessage] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('1')

  const handleCupom = () => {
    if (!selectedClient || !selectedProduct) {
      setMessage('Selecione um cliente e um produto para emitir o cupom.')
      return
    }
    const client = clients.find((c) => c.id === Number(selectedClient))
    const product = products.find((p) => p.id === Number(selectedProduct))
    const total = (product?.price ?? 0) * Number(quantity)
    setMessage(
      `Cupom eletrônico emitido! Cliente: ${client?.name} | Produto: ${product?.name} x${quantity} | Total: R$ ${total.toFixed(2)}`,
    )
  }

  const handleNfe = () => {
    if (!selectedClient || !selectedProduct) {
      setMessage('Selecione um cliente e um produto para emitir a nota.')
      return
    }
    const client = clients.find((c) => c.id === Number(selectedClient))
    const product = products.find((p) => p.id === Number(selectedProduct))
    const total = (product?.price ?? 0) * Number(quantity)
    setMessage(
      `Nota eletrônica (NF-e) gerada! Destinatário: ${client?.name} | Produto: ${product?.name} x${quantity} | Valor: R$ ${total.toFixed(2)} | Enviada por e-mail.`,
    )
  }

  return (
    <article className="panel large-panel">
      <div className="panel-header">
        <h2>Financeiro</h2>
      </div>

      <p className="form-hint">
        Emita cupom eletrônico ou nota fiscal eletrônica para vendas realizadas.
      </p>

      <div className="form-grid finance-form">
        <label>
          <span>Cliente</span>
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Produto</span>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            <option value="">Selecione um produto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — R$ {p.price.toFixed(2)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Quantidade</span>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
      </div>

      <div className="finance-actions">
        <button type="button" className="primary-button" onClick={handleCupom}>
          Emitir cupom eletrônico
        </button>
        <button type="button" className="secondary-button" onClick={handleNfe}>
          Emitir nota eletrônica
        </button>
      </div>

      {message && (
        <div className={message.includes('emitido') || message.includes('gerada') ? 'success-box' : 'error-box'}>
          {message}
        </div>
      )}

      <div className="finance-summary">
        <div>
          <span>Caixa</span>
          <strong>R$ 36.780,00</strong>
        </div>
        <div>
          <span>Vendas hoje</span>
          <strong>R$ 8.640,00</strong>
        </div>
        <div>
          <span>Em aberto</span>
          <strong>R$ 2.150,00</strong>
        </div>
      </div>
    </article>
  )
}
