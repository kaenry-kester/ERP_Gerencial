import { useNavigate } from 'react-router-dom'
import type { Aviso } from '../components/formulario/FaixaAviso'
import { ErroApi, sair } from '../services/api'

/**
 * Trata o 401 de uma chamada com token (sessão vencida ou usuário desativado):
 * apaga a sessão e volta para o login. Retorna true quando tratou o erro.
 */
export function useSessaoExpirada() {
  const navigate = useNavigate()

  return (erro: unknown) => {
    if (!(erro instanceof ErroApi) || erro.status !== 401) return false
    const aviso: Aviso = { tipo: 'erro', texto: 'Sua sessão expirou. Entre de novo.' }
    sair()
    navigate('/login', { replace: true, state: { aviso } })
    return true
  }
}
