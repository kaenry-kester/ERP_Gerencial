import type { Aviso } from '../../components/formulario/FaixaAviso'
import { IconeAlerta, IconeCheck } from '../../components/icones/Icones'

// Aviso de sucesso (azul) ou erro (vermelho) dentro das páginas do ERP.
export default function AvisoPagina({ aviso }: { aviso: NonNullable<Aviso> }) {
  return (
    <p className={aviso.tipo === 'erro' ? 'erp-aviso erro' : 'erp-aviso'} role="status">
      {aviso.tipo === 'erro' ? <IconeAlerta tamanho={18} /> : <IconeCheck tamanho={18} />}
      {aviso.texto}
    </p>
  )
}
