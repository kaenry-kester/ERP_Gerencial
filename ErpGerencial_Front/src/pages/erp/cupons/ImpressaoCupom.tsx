import { rotuloPagamento, type Cupom } from '../../../services/api'
import { dataPorExtenso, valorPorExtenso } from '../../../utils/extenso'
import { formatarDocumento, formatarMoeda, formatarQuantidade, formatarTelefone } from '../../../utils/validacao'
import { numeroCupom } from './numero'
import './impressao.css'

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const cidadeUf = (cidade: string | null, uf: string | null) => [cidade, uf].filter(Boolean).join('/')

/** "2 x Produto A; 1 x Conserto" — o "correspondente a" do recibo quando não foi digitado. */
const resumoItens = (cupom: Cupom) =>
  cupom.itens.map((i) => `${formatarQuantidade(i.quantidade)} x ${i.descricao}`).join('; ')

/** Cupom de venda para impressora térmica de 80 mm (também usado na pré-visualização da tela). */
export function CupomTermico({ cupom }: { cupom: Cupom }) {
  const enderecoEmitente = [cupom.emitenteEndereco, cidadeUf(cupom.emitenteCidade, cupom.emitenteUf)]
    .filter(Boolean)
    .join(' - ')
  return (
    <div className="ct">
      {cupom.canceladoEm && <p className="ct-cancelado">CANCELADO</p>}

      <header className="ct-centro">
        <p className="ct-empresa">{cupom.emitenteNome}</p>
        {cupom.emitenteRazaoSocial && <p>{cupom.emitenteRazaoSocial}</p>}
        {cupom.emitenteDocumento && <p>CNPJ/CPF: {formatarDocumento(cupom.emitenteDocumento)}</p>}
        {enderecoEmitente && <p>{enderecoEmitente}</p>}
        {cupom.emitenteTelefone && <p>Tel.: {formatarTelefone(cupom.emitenteTelefone)}</p>}
      </header>

      <hr />
      <p className="ct-centro ct-titulo">CUPOM NÃO FISCAL</p>
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

/** Uma via do recibo, no modelo do talão de papel (Recibo · Nº · Valor, e as linhas para preencher). */
function ViaRecibo({ cupom, via }: { cupom: Cupom; via: string }) {
  const cidade = cupom.emitenteCidade ?? '______________________'
  const enderecoEmitente = [cupom.emitenteEndereco, cidadeUf(cupom.emitenteCidade, cupom.emitenteUf)]
    .filter(Boolean)
    .join(' - ')
  return (
    <section className="rc-via">
      {cupom.canceladoEm && <p className="rc-cancelado">CANCELADO</p>}
      <div className="rc-topo">
        <p className="rc-titulo">Recibo</p>
        <p className="rc-caixa">
          <span className="rc-rotulo">Nº</span>
          <span className="rc-numero">{numeroCupom(cupom.numero)}</span>
        </p>
        <p className="rc-caixa rc-valor">
          <span className="rc-rotulo">Valor</span>
          <span className="rc-numero">{formatarMoeda(cupom.total)}</span>
        </p>
      </div>

      <p className="rc-linha">
        <span className="rc-rotulo">Recebi(emos) de</span>
        <span className="rc-preenchido">{cupom.clienteNome ?? 'Consumidor'}</span>
      </p>
      <p className="rc-quantia">
        <span className="rc-rotulo">a quantia de</span>
        <span className="rc-extenso">{valorPorExtenso(cupom.total)}</span>
      </p>
      <p className="rc-linha">
        <span className="rc-rotulo">Endereço</span>
        <span className="rc-preenchido">{cupom.clienteEndereco ?? ''}</span>
      </p>
      <p className="rc-linha">
        <span className="rc-rotulo">Correspondente a</span>
        <span className="rc-preenchido">{cupom.referente ?? resumoItens(cupom)}</span>
      </p>
      <p className="rc-linha">
        <span className="rc-preenchido">
          Pagamento: {rotuloPagamento(cupom.formaPagamento)}
          {cupom.formaPagamento2 && ` + ${rotuloPagamento(cupom.formaPagamento2)}`}
          {cupom.desconto > 0 && ` · desconto de ${formatarMoeda(cupom.desconto)}`}
        </span>
        <span className="rc-rotulo">e para clareza firmo(amos) o presente.</span>
      </p>
      <p className="rc-data">
        {cidade}, {dataPorExtenso(cupom.emitidoEm)}
      </p>

      <div className="rc-rodape">
        <div className="rc-emitente">
          <p className="rc-linha">
            <span className="rc-rotulo">Emitente</span>
            <span className="rc-preenchido">{cupom.emitenteRazaoSocial ?? cupom.emitenteNome}</span>
          </p>
          <p className="rc-linha">
            <span className="rc-rotulo">Endereço</span>
            <span className="rc-preenchido">{enderecoEmitente}</span>
          </p>
          <p className="rc-linha">
            <span className="rc-rotulo">CNPJ / CPF / RG</span>
            <span className="rc-preenchido">
              {cupom.emitenteDocumento ? formatarDocumento(cupom.emitenteDocumento) : ''}
            </span>
          </p>
        </div>
        <div className="rc-assinatura">
          <span className="rc-assinatura-linha" />
          <span className="rc-rotulo">(Assinatura)</span>
        </div>
      </div>
      <p className="rc-via-nome">{via}</p>
    </section>
  )
}

/** Recibo em A4: duas vias na mesma folha (cliente e emitente), com linha de corte. */
export function ReciboA4({ cupom }: { cupom: Cupom }) {
  return (
    <div className="rc">
      <ViaRecibo cupom={cupom} via="1ª via — Cliente" />
      <p className="rc-corte" aria-hidden="true">
        ✂ corte aqui
      </p>
      <ViaRecibo cupom={cupom} via="2ª via — Emitente" />
    </div>
  )
}
