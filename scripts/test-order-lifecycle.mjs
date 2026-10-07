import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Dedicated offline synthetic database only. Never accepts arbitrary DB URLs,
// hostnames, production project refs or user-provided credentials.
const container = 'homecare-order-lifecycle-qa'
const inspect = spawnSync('docker', ['inspect', container], { encoding: 'utf8' })
if (inspect.status !== 0) throw new Error('Start the dedicated local QA container first')
const info = JSON.parse(inspect.stdout)[0]
if (info.HostConfig.NetworkMode !== 'none' || Object.keys(info.HostConfig.PortBindings ?? {}).length)
  throw new Error('QA database must have network none and no published ports')
for (const name of Object.keys(info.NetworkSettings.Networks ?? {})) {
  const network = spawnSync('docker', ['network', 'inspect', name], { encoding: 'utf8' })
  if (name !== 'homecare-lifecycle-internal' || network.status !== 0 || JSON.parse(network.stdout)[0].Internal !== true)
    throw new Error('QA database may attach only to its dedicated internal network')
}
const sql = readFileSync(fileURLToPath(new URL('./tests/order-lifecycle.sql', import.meta.url)), 'utf8')
const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD=homecare-local-qa-only', container,
  'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'homecare_lifecycle_test'], { input: sql, encoding: 'utf8' })
process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
if (result.status !== 0) process.exit(result.status ?? 1)
