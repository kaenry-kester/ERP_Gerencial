import { useNavigate } from 'react-router-dom'
import type { Aviso } from '../components/formulario/FaixaAviso'
import { ErroApi, sair, sairDaLoja } from '../services/api'

/**
 * Trata o 401/403 de uma chamada com token: apaga a sessão vencida e volta para a tela de entrada.
 * Retorna true quando tratou o erro (a tela não precisa mostrar mais nada).
 */
export function useSessaoExpirada(tipo: 'conta' | 'loja') {
  const navigate = useNavigate()

  return (erro: unknown, cnpj?: string) => {
    if (!(erro instanceof ErroApi) || (erro.status !== 401 && erro.status !== 403)) return false
    const aviso: Aviso = { tipo: 'erro', texto: 'Sua sessão expirou. Entre de novo.' }
    if (tipo === 'conta') {
      sair()
      navigate('/login', { replace: true, state: { aviso } })
    } else {
      sairDaLoja()
      navigate('/loja/entrar', { replace: true, state: { aviso, cnpj } })
    }
    return true
  }
}
