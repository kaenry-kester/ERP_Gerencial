import { Link } from 'react-router-dom'
import type { MovimentoEstoque } from '../../../services/api'
import { formatarQuantidade } from '../../../utils/validacao'
import { TIPOS_MOVIMENTO } from './movimentos'
import './estoque.css'

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Tabela de movimentações (usada nesta página e na página do produto). */
export default function TabelaMovimentos({ itens, mostrarProduto = true }: { itens: MovimentoEstoque[]; mostrarProduto?: boolean }) {
  return (
    <div className="estoque-tabela-area">
      <table className="estoque-tabela">
        <thead>
          <tr>
            <th scope="col">Data</th>
            {mostrarProduto && <th scope="col">Produto</th>}
            <th scope="col">Tipo</th>
            <th scope="col" className="numero">Quantidade</th>
            <th scope="col" className="numero">Saldo depois</th>
            <th scope="col">Detalhe</th>
            <th scope="col">Quem</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((m) => {
            const tipo = TIPOS_MOVIMENTO[m.tipo] ?? { rotulo: m.tipo, emoji: '•' }
            const detalhe = [m.observacao].filter(Boolean)
            return (
              <tr key={m.id}>
                <td>{dataHora(m.criadoEm)}</td>
                {mostrarProduto && (
                  <td>
                    <Link to={`/app/produtos/${m.produtoId}`} className="lista-nome">
                      {m.produtoNome}
                    </Link>
                  </td>
                )}
                <td>
                  <span className={`mov-tipo ${m.tipo}`}>
                    <span aria-hidden="true">{tipo.emoji}</span> {tipo.rotulo}
                  </span>
                </td>
                <td className={`numero mov-quantidade ${m.quantidade >= 0 ? 'entra' : 'sai'}`}>
                  {m.quantidade > 0 ? '+' : ''}
                  {formatarQuantidade(m.quantidade)}
                </td>
                <td className="numero">{formatarQuantidade(m.saldoApos)}</td>
                <td>
                  {detalhe.join(' · ')}
                  {m.cupomId && (
                    <>
                      {detalhe.length > 0 && ' · '}
                      <Link to={`/app/cupom-fiscal/${m.cupomId}`}>ver cupom</Link>
                    </>
                  )}
                  {!detalhe.length && !m.cupomId && '—'}
                </td>
                <td>{m.usuarioNome}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
