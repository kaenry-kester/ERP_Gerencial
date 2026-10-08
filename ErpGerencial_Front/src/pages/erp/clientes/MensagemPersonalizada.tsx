import { useState } from 'react'
import CampoArea from '../../../components/formulario/CampoArea'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../../components/icones/Icones'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { mensagemDe, salvarMensagemCliente, type Cliente } from '../../../services/api'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import { MENSAGEM_MAXIMO, TRECHOS_MENSAGEM } from './formatos'
import '../../../styles/acesso.css'

type Props = {
  cliente: Cliente
  onSalvo: (cliente: Cliente) => void
}

// Campo, direto na página do cliente, para escrever a mensagem de WhatsApp só dele.
// Vazio: o cliente recebe a mensagem padrão (definida na lista de clientes).
export default function MensagemPersonalizada({ cliente, onSalvo }: Props) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const salva = cliente.mensagemWhatsapp ?? ''
  const [texto, setTexto] = useState(salva)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const mudou = texto.trim() !== salva

  const salvar = async () => {
    setSalvando(true)
    setAviso(null)
    try {
      const atualizado = await salvarMensagemCliente(sessao.token, cliente.id, texto)
      setTexto(atualizado.mensagemWhatsapp ?? '')
      onSalvo(atualizado)
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvando(false)
    }
  }

  const inserir = (trecho: string) => {
    setTexto((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${trecho}`.slice(0, MENSAGEM_MAXIMO))
    setAviso(null)
    document.getElementById('cliente-mensagem-personalizada')?.focus()
  }

  return (
    <section className="detalhe-grupo" aria-labelledby="titulo-mensagem-personalizada">
      <h2 id="titulo-mensagem-personalizada" className="detalhe-titulo">
        Mensagem personalizada
      </h2>
      <div className="mensagem-personalizada">
        <CampoArea
          id="cliente-mensagem-personalizada"
          rotulo="Escrever mensagem personalizada"
          placeholder="Vazia: este cliente recebe a mensagem padrão (da lista de clientes)."
          maxLength={MENSAGEM_MAXIMO}
          valor={texto}
          onChange={(v) => {
            setTexto(v)
            setAviso(null)
          }}
        />
        <div className="mensagem-dialogo-linha">
          <div className="mensagem-trechos">
            <span>Inserir:</span>
            {TRECHOS_MENSAGEM.map((t) => (
              <button key={t.trecho} type="button" className="mensagem-trecho" onClick={() => inserir(t.trecho)}>
                {t.rotulo}
              </button>
            ))}
          </div>
          <span className="mensagem-dialogo-contagem">
            {texto.length}/{MENSAGEM_MAXIMO}
          </span>
        </div>
        <div className="erp-form-acoes">
          {aviso && <AvisoPagina aviso={aviso} />}
          <span className="mensagem-personalizada-situacao">
            {salva ? 'Este cliente recebe esta mensagem no lugar da padrão.' : 'Este cliente recebe a mensagem padrão.'}
          </span>
          <button type="button" className="pagina-botao" onClick={salvar} disabled={!mudou || salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : mudou ? 'Salvar mensagem' : 'Mensagem salva'}
          </button>
        </div>
      </div>
    </section>
  )
}
