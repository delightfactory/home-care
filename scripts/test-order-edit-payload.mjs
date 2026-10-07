import assert from 'node:assert/strict'
import { orderEditItems } from '../src/api/order-edit-payload.ts'
const catalog = [{ id: 'service', price: 100 }]
const original = { id: 'retained-item', service_id: 'service', quantity: 2, custom_price: 25 }
assert.deepEqual(orderEditItems([original], catalog), [{ id: 'retained-item', service_id: 'service', quantity: 2, unit_price: 25 }])
assert.equal(orderEditItems([{ ...original, custom_price: 0 }], catalog)[0].unit_price, 0)
assert.equal(orderEditItems([{ ...original, custom_price: undefined }], catalog)[0].unit_price, 100)
assert.equal(orderEditItems([{ service_id: '', quantity: 1 }], catalog)[0].service_id, null)
assert.equal(Object.hasOwn(orderEditItems([original], catalog)[0], 'total_price'), false)
assert.deepEqual(original, { id: 'retained-item', service_id: 'service', quantity: 2, custom_price: 25 })
console.log('PASS 6 edit item identity/custom-price/server-total payload cases')
