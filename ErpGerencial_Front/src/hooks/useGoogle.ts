import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Aviso } from '../components/formulario/FaixaAviso'
import { configGoogle, destinoDepoisDeEntrar, entrarComGoogle, mensagemDe, salvarSessao } from '../services/api'
import { carregarGoogle, criarClienteGoogle, type ClienteCodigo } from '../services/google'

type Estado = 'carregando' | 'pronto' | 'nao-configurado' | 'sem-conexao'

/**
 * Botão "Continuar com o Google" das telas de login e cadastro.
 * Prepara o Google assim que a tela abre, para a janela do Google abrir
 * direto no clique (navegadores bloqueiam popups que demoram para abrir).
 * Sem empresa (conta nova pelo Google) → criar a empresa; com empresa → ERP.
 */
export function useGoogle(mostrarAviso: (aviso: Aviso) => void) {
  const navigate = useNavigate()
  const cliente = useRef<ClienteCodigo | null>(null)
  const avisar = useRef(mostrarAviso)
  const [estado, setEstado] = useState<Estado>('carregando')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    avisar.current = mostrarAviso
  })

  useEffect(() => {
    let ativo = true

    const receberCodigo = async (codigo: string) => {
      setEnviando(true)
      try {
        const { contaNova, ...sessao } = await entrarComGoogle(codigo)
        salvarSessao(sessao)
        const primeiroNome = sessao.usuario.nome.split(' ')[0]
        const texto = contaNova
          ? `Conta criada com o Google, ${primeiroNome}! Falta só o nome da sua empresa.`
          : `Olá, ${primeiroNome}! Falta só o nome da sua empresa.`
        navigate(destinoDepoisDeEntrar(sessao), sessao.empresa ? undefined : { state: { aviso: { tipo: 'ok', texto } } })
      } catch (erro) {
        if (ativo) {
          avisar.current({ tipo: 'erro', texto: mensagemDe(erro) })
          setEnviando(false)
        }
      }
    }

    Promise.all([configGoogle(), carregarGoogle()])
      .then(([{ clientId }]) => {
        if (!ativo) return
        if (!clientId) {
          setEstado('nao-configurado')
          return
        }
        cliente.current = criarClienteGoogle(
          clientId,
          (resposta) => {
            if (resposta.code) receberCodigo(resposta.code)
            // access_denied = a pessoa clicou em "Cancelar" no Google: nada a avisar.
            else if (resposta.error !== 'access_denied')
              avisar.current({ tipo: 'erro', texto: 'O Google não confirmou o acesso. Tente de novo.' })
          },
          (erro) => {
            if (erro.type === 'popup_failed_to_open')
              avisar.current({ tipo: 'erro', texto: 'O navegador bloqueou a janela do Google. Libere pop-ups.' })
          },
        )
        setEstado('pronto')
      })
      // API desligada ou script do Google bloqueado (sem internet, bloqueador de anúncios)
      .catch(() => {
        if (ativo) setEstado('sem-conexao')
      })

    return () => {
      ativo = false
    }
  }, [navigate])

  const entrar = () => {
    if (enviando) return
    if (estado === 'pronto' && cliente.current) {
      cliente.current.requestCode()
      return
    }
    const textos: Record<Estado, string> = {
      pronto: 'Conectando ao Google... tente de novo em instantes.',
      carregando: 'Conectando ao Google... tente de novo em instantes.',
      'nao-configurado': 'O acesso com o Google ainda não foi ativado no servidor.',
      'sem-conexao': 'Não foi possível conectar ao Google. Recarregue a página.',
    }
    avisar.current({ tipo: 'erro', texto: textos[estado] })
  }

  return { entrar, enviando }
}
