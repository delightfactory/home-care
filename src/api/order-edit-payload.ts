// Preserve retained identities and explicit zero prices. SQL owns totals.
export function orderEditItems(rows: { id?: string; service_id: string; quantity: number; custom_price?: number }[], services: { id: string; price: number }[]) {
  return rows.map(row => ({ id: row.id, service_id: row.service_id || null, quantity: row.quantity,
    unit_price: row.custom_price ?? services.find(service => service.id === row.service_id)?.price ?? 0 }))
}
