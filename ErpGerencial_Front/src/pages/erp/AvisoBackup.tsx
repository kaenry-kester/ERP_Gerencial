import { useEffect, useState } from 'react'
import { obterSituacaoBackup } from '../../services/api'
import { useErp } from './contexto'

/** Depois de quanto tempo sem cópia aparece o aviso. */
const LIMITE_HORAS = 24

const haQuanto = (iso: string) => {
  const horas = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (horas < 48) return `há ${Math.floor(horas)} horas`
  return `há ${Math.floor(horas / 24)} dias`
}

/**
 * Aviso da tela inicial: aparece só quando a última cópia de segurança tem mais de 1 dia (ou nunca foi feita).
 * As cópias vão para a pasta do Google Drive/OneDrive configurada no programa da loja.
 */
export default function AvisoBackup() {
  const { sessao } = useErp()
  // Texto do aviso (null = sem aviso), calculado quando a situação chega
  const [aviso, setAviso] = useState<{ texto: string; pasta: string } | null>(null)

  useEffect(() => {
    let ativo = true
    obterSituacaoBackup(sessao.token)
      .then((s) => {
        if (!ativo || !s.ativo) return
        const velha = !s.ultima || Date.now() - new Date(s.ultima).getTime() > LIMITE_HORAS * 3_600_000
        if (!velha) return
        setAviso({
          texto: s.ultima ? `A última cópia de segurança foi ${haQuanto(s.ultima)}.` : 'Nenhuma cópia de segurança foi feita ainda.',
          pasta: s.pasta,
        })
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [sessao.token])

  if (!aviso) return null

  return (
    <p className="aviso-backup" role="status">
      <span aria-hidden="true">⚠️</span>
      <span>
        <strong>{aviso.texto}</strong> Deixe o sistema aberto e o Google Drive (ou OneDrive) ligado. Pasta: {aviso.pasta}
      </span>
    </p>
  )
}
