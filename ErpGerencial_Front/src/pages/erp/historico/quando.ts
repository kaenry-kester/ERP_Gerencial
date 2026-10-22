/** "hoje, 14:30", "ontem", "há 5 dias" ou a data. */
export function quando(texto: string) {
  const data = new Date(texto)
  const hoje = new Date()
  const dias = Math.floor(
    (new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() -
      new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()) /
      86_400_000,
  )
  if (dias <= 0) return `hoje, ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return data.toLocaleDateString('pt-BR')
}
