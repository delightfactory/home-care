import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const filePath = process.argv[2]

if (!filePath) {
  throw new Error('Usage: node scripts/audit-backup-v2.mjs <backup.json>')
}

const raw = await readFile(filePath)
const parsed = JSON.parse(raw.toString('utf8'))
const manifest = Array.isArray(parsed.manifest) ? parsed.manifest : []
const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {}
const payloadNames = Object.keys(payload)
const manifestNames = manifest.map((item) => item.table_name)

const sumManifestRows = manifest.reduce((sum, item) => sum + Number(item.row_count || 0), 0)
const sumActualRows = payloadNames.reduce(
  (sum, name) => sum + (Array.isArray(payload[name]) ? payload[name].length : 0),
  0
)

const rowMismatches = manifest
  .filter((item) => (
    !Array.isArray(payload[item.table_name])
    || payload[item.table_name].length !== Number(item.row_count)
  ))
  .map((item) => ({
    table: item.table_name,
    expected: Number(item.row_count),
    actual: Array.isArray(payload[item.table_name])
      ? payload[item.table_name].length
      : null
  }))

const duplicatePrimaryIds = []
for (const name of payloadNames) {
  const rows = payload[name]
  if (
    !Array.isArray(rows)
    || rows.length === 0
    || !rows.every((row) => row && Object.hasOwn(row, 'id'))
  ) {
    continue
  }

  const ids = new Set()
  let duplicates = 0

  for (const row of rows) {
    const id = String(row.id)
    if (ids.has(id)) duplicates += 1
    else ids.add(id)
  }

  if (duplicates > 0) duplicatePrimaryIds.push({ table: name, duplicates })
}

const relationChecks = []
const checkRelation = (childTable, childColumn, parentTable, parentColumn = 'id', nullable = true) => {
  const children = payload[childTable]
  const parents = payload[parentTable]
  if (!Array.isArray(children) || !Array.isArray(parents)) return

  const parentValues = new Set(
    parents
      .map((row) => row?.[parentColumn])
      .filter((value) => value !== null && value !== undefined)
      .map(String)
  )

  let checked = 0
  let nullValues = 0
  let missingParents = 0

  for (const row of children) {
    const value = row?.[childColumn]
    if (value === null || value === undefined) {
      nullValues += 1
      if (!nullable) missingParents += 1
      continue
    }

    checked += 1
    if (!parentValues.has(String(value))) missingParents += 1
  }

  relationChecks.push({
    relation: `${childTable}.${childColumn} -> ${parentTable}.${parentColumn}`,
    checked,
    null_values: nullValues,
    missing_parents: missingParents
  })
}

checkRelation('users', 'role_id', 'roles')
checkRelation('team_members', 'team_id', 'teams', 'id', false)
checkRelation('team_members', 'worker_id', 'workers', 'id', false)
checkRelation('order_items', 'order_id', 'orders', 'id', false)
checkRelation('route_orders', 'route_id', 'routes', 'id', false)
checkRelation('route_orders', 'order_id', 'orders', 'id', false)
checkRelation('order_workers', 'order_id', 'orders', 'id', false)
checkRelation('order_workers', 'worker_id', 'workers', 'id', false)
checkRelation('order_status_logs', 'order_id', 'orders', 'id', false)
checkRelation('invoice_items', 'invoice_id', 'invoices', 'id', false)
checkRelation('conversation_participants', 'conversation_id', 'conversations', 'id', false)
checkRelation('messages', 'conversation_id', 'conversations', 'id', false)
checkRelation('message_read_receipts', 'message_id', 'messages', 'id', false)

const report = {
  file: {
    bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex')
  },
  header: {
    format: parsed.format,
    version: parsed.version,
    backup: parsed.backup
  },
  structure: {
    manifest_count: manifest.length,
    payload_table_count: payloadNames.length,
    manifest_order_valid: manifest.every(
      (item, index) => Number(item.table_order) === index + 1
    ),
    missing_payload_tables: manifestNames.filter(
      (name) => !Object.hasOwn(payload, name)
    ),
    extra_payload_tables: payloadNames.filter(
      (name) => !manifestNames.includes(name)
    ),
    duplicate_manifest_tables: manifestNames.filter(
      (name, index, names) => names.indexOf(name) !== index
    ),
    non_array_payloads: payloadNames.filter((name) => !Array.isArray(payload[name]))
  },
  rows: {
    declared_total: Number(parsed.backup?.total_rows),
    manifest_total: sumManifestRows,
    actual_total: sumActualRows,
    row_mismatches: rowMismatches
  },
  uniqueness: {
    duplicate_primary_ids: duplicatePrimaryIds
  },
  relations: relationChecks,
  verdict: {
    format_valid: parsed.format === 'home-care-backup-v2' && parsed.version === 2,
    table_counts_valid: (
      manifest.length === Number(parsed.backup?.tables_count)
      && payloadNames.length === Number(parsed.backup?.tables_count)
    ),
    row_counts_valid: (
      sumManifestRows === Number(parsed.backup?.total_rows)
      && sumActualRows === Number(parsed.backup?.total_rows)
      && rowMismatches.length === 0
    ),
    keys_valid: duplicatePrimaryIds.length === 0,
    checked_relations_valid: relationChecks.every(
      (relation) => relation.missing_parents === 0
    )
  }
}

console.log(JSON.stringify(report, null, 2))
