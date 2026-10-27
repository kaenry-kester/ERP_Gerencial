import { rotuloPagamento, type Cupom } from '../../../services/api'
import { formatarDocumento, formatarMoeda, formatarQuantidade, formatarTelefone } from '../../../utils/validacao'
import { numeroCupom } from './numero'
import './impressao.css'

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const cidadeUf = (cidade: string | null, uf: string | null) => [cidade, uf].filter(Boolean).join('/')

/** Cupom de venda para impressora térmica de 80 mm (também usado na pré-visualização da tela). */
export function CupomTermico({ cupom, logoUrl }: { cupom: Cupom; logoUrl?: string | null }) {
  const enderecoEmitente = [cupom.emitenteEndereco, cidadeUf(cupom.emitenteCidade, cupom.emitenteUf)]
    .filter(Boolean)
    .join(' - ')
  return (
    <div className="ct">
      {cupom.canceladoEm && <p className="ct-cancelado">CANCELADO</p>}

      <header className="ct-centro">
        {logoUrl && <img src={logoUrl} alt="" className="ct-logo" />}
        <p className="ct-empresa">{cupom.emitenteNome}</p>
        {cupom.emitenteRazaoSocial && <p>{cupom.emitenteRazaoSocial}</p>}
        {cupom.emitenteDocumento && <p>CNPJ/CPF: {formatarDocumento(cupom.emitenteDocumento)}</p>}
        {enderecoEmitente && <p>{enderecoEmitente}</p>}
        {cupom.emitenteTelefone && <p>Tel.: {formatarTelefone(cupom.emitenteTelefone)}</p>}
      </header>

      <hr />
      <p className="ct-centro ct-titulo">CUPOM FISCAL</p>
      <p className="ct-linha">
        <span>Nº {numeroCupom(cupom.numero)}</span>
        <span>{dataHora(cupom.emitidoEm)}</span>
      </p>

      <hr />
      <p>
        <strong>Cliente:</strong> {cupom.clienteNome ?? 'Consumidor'}
      </p>
      {cupom.clienteDocumento && <p>CPF/CNPJ: {formatarDocumento(cupom.clienteDocumento)}</p>}
      {cupom.clienteEndereco && <p>{cupom.clienteEndereco}</p>}

      <hr />
      {cupom.itens.length > 0 ? (
        <ol className="ct-itens">
          {cupom.itens.map((item, i) => (
            <li key={item.id}>
              <p>
                {String(i + 1).padStart(3, '0')} <strong>{item.descricao}</strong>
              </p>
              {(item.codigo || item.codigoBarras) && (
                <p className="ct-suave">
                  {[item.codigo && `Cód. ${item.codigo}`, item.codigoBarras && `Cód. barras ${item.codigoBarras}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {(item.observacao || item.data) && (
                <p className="ct-suave">
                  {[item.data && `Data: ${item.data.split('-').reverse().join('/')}`, item.observacao]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <p className="ct-linha">
                <span>
                  {formatarQuantidade(item.quantidade)} x {formatarMoeda(item.valorUnitario)}
                </span>
                <span>{formatarMoeda(item.total)}</span>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>{cupom.referente}</p>
      )}

      <hr />
      {cupom.desconto > 0 && (
        <>
          <p className="ct-linha">
            <span>Subtotal</span>
            <span>{formatarMoeda(cupom.subtotal)}</span>
          </p>
          <p className="ct-linha">
            <span>Desconto</span>
            <span>- {formatarMoeda(cupom.desconto)}</span>
          </p>
        </>
      )}
      <p className="ct-linha ct-total">
        <span>TOTAL</span>
        <span>{formatarMoeda(cupom.total)}</span>
      </p>
      <p className="ct-linha">
        <span>{rotuloPagamento(cupom.formaPagamento)}</span>
        <span>{formatarMoeda(cupom.valorPagamento1 ?? cupom.total)}</span>
      </p>
      {cupom.formaPagamento2 && (
        <p className="ct-linha">
          <span>{rotuloPagamento(cupom.formaPagamento2)}</span>
          <span>{formatarMoeda(cupom.valorPagamento2 ?? 0)}</span>
        </p>
      )}
      {cupom.valorRecebido !== null && (
        <>
          <p className="ct-linha">
            <span>Total pago</span>
            <span>{formatarMoeda(cupom.valorRecebido)}</span>
          </p>
          <p className="ct-linha">
            <span>Troco</span>
            <span>{formatarMoeda(cupom.troco ?? 0)}</span>
          </p>
        </>
      )}

      {(cupom.itens.length > 0 && cupom.referente) || cupom.observacao ? <hr /> : null}
      {cupom.itens.length > 0 && cupom.referente && <p>Referente a: {cupom.referente}</p>}
      {cupom.observacao && <p>Obs.: {cupom.observacao}</p>}

      <hr />
      <p>Vendedor: {cupom.vendedorNome ?? cupom.emitidoPor}</p>
      {cupom.canceladoEm && (
        <p>
          Cancelado em {dataHora(cupom.canceladoEm)}: {cupom.motivoCancelamento}
        </p>
      )}
      <p className="ct-centro ct-rodape">Obrigado pela preferência!</p>
    </div>
  )
}
