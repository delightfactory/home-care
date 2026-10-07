import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const container = 'homecare-order-lifecycle-qa'
const inspect = spawnSync('docker', ['inspect', container], { encoding: 'utf8' })
assert.equal(inspect.status, 0)
const info = JSON.parse(inspect.stdout)[0]
assert.equal(info.HostConfig.NetworkMode, 'none')
assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0)
for (const name of Object.keys(info.NetworkSettings.Networks ?? {})) {
  const network = spawnSync('docker', ['network', 'inspect', name], { encoding: 'utf8' })
  assert.equal(name, 'homecare-lifecycle-internal')
  assert.equal(network.status, 0)
  assert.equal(JSON.parse(network.stdout)[0].Internal, true)
}
const args = ['exec', '-i', '-e', 'PGPASSWORD=homecare-local-qa-only', container,
  'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'homecare_lifecycle_test']
function sql(text) {
  const result = spawnSync('docker', args, { input: text, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
const actor = 'b1000000-0000-0000-0000-000000000001'
const claim = `set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true);`
const route1 = 'b5000000-0000-0000-0000-000000000001'
const route2 = 'b5000000-0000-0000-0000-000000000002'
const order1 = 'b6000000-0000-0000-0000-000000000001'
const order2 = 'b6000000-0000-0000-0000-000000000002'
const team2 = 'b4000000-0000-0000-0000-000000000002'

// A tiny committed synthetic fixture is needed for separate sessions. All
// concurrent mutations below roll back; retire the dedicated database after QA.
if (sql(`select count(*) from public.routes where id='${route1}'`) === '0') {
  let fixture = readFileSync(fileURLToPath(new URL('./tests/order-lifecycle.sql', import.meta.url)), 'utf8').split('-- Legacy conflicting history')[0]
  fixture = fixture.replaceAll('a1000000','b1000000').replaceAll('a2000000','b2000000').replaceAll('a3000000','b3000000')
    .replaceAll('a4000000','b4000000').replaceAll('a5000000','b5000000').replaceAll('a6000000','b6000000').replaceAll('QA-LIFECYCLE','QA-CONCURRENCY')
    .replaceAll('a-qa-customer','b-qa-customer')
  fixture += `${claim}
    select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','${route1}',
      'expected',public.lifecycle_snapshot('route','${route1}'),'desired',jsonb_build_array(jsonb_build_object(
      'order_id','${order1}','sequence_order',1,'expected',public.lifecycle_snapshot('order','${order1}')))));
    select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','${route2}',
      'expected',public.lifecycle_snapshot('route','${route2}'),'desired',jsonb_build_array(jsonb_build_object(
      'order_id','${order2}','sequence_order',1,'expected',public.lifecycle_snapshot('order','${order2}')))));
    commit;`
  sql(fixture)
}
function snapshot(kind, id) {
  const output = sql(`begin; ${claim} select public.lifecycle_snapshot('${kind}','${id}'); rollback;`)
  return JSON.parse(output.split('\n').find(line => line.startsWith('{')))
}
function mutation(payload) {
  const encoded = JSON.stringify(payload).replaceAll("'", "''")
  return `select public.lifecycle_mutate('${crypto.randomUUID()}', '${encoded}'::jsonb);`
}
function session(text, marker) {
  let output = '', errors = ''
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] })
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  child.stdout.on('data', data => { output += data; if (marker && output.includes(marker)) resolveReady() })
  child.stderr.on('data', data => { errors += data })
  const done = new Promise((resolve, reject) => child.on('close', code => {
    if (code === 0) resolve({ output, errors }); else { const error = new Error(errors); rejectReady(error); reject(error) }
  }))
  child.stdin.end(text)
  return { ready, done }
}
async function pair(name, first, second) {
  const held = session(`begin; set local lock_timeout='5s'; ${claim} ${first} \n\\echo QA_LOCK_HELD\nselect pg_sleep(1.5); rollback;`, 'QA_LOCK_HELD')
  await held.ready
  const start = performance.now()
  const contender = session(`begin; set local lock_timeout='5s'; ${claim} ${second} rollback;`)
  const results = await Promise.all([held.done, contender.done])
  assert.ok(performance.now() - start >= 900, `${name}: contender did not wait for lifecycle lock`)
  assert.ok(results.every(result => !result.errors.includes('deadlock')), `${name}: deadlock`)
  console.log(`PASS ${name}: separate sessions serialized, no deadlock, both rolled back`)
}
const s1 = snapshot('route', route1), s2 = snapshot('route', route2)
const o1 = snapshot('order', order1), o2 = snapshot('order', order2)
const transfer1 = mutation({ op: 'transfer', route_id: route1, destination_id: route2, order_id: order1,
  link_id: s1.links[0].id, expected: s1, destination_expected: s2, order_expected: o1 })
const transfer2 = mutation({ op: 'transfer', route_id: route2, destination_id: route1, order_id: order2,
  link_id: s2.links[0].id, expected: s2, destination_expected: s1, order_expected: o2 })
await pair('opposing transfers', transfer1, transfer2)
const start = mutation({ op: 'start', order_id: order1, expected: o1 })
const changeTeam = mutation({ op: 'route_update', route_id: route1, expected: s1, data: { team_id: team2 } })
await pair('start versus route team change', start, changeTeam)
await pair('start versus membership leave', start,
  "update public.team_members set left_at=clock_timestamp() where worker_id='b3000000-0000-0000-0000-000000000001';")
assert.deepEqual(snapshot('route', route1), s1)
assert.deepEqual(snapshot('route', route2), s2)
assert.deepEqual(snapshot('order', order1), o1)
console.log('PASS snapshots restored; synthetic committed fixture remains only in offline QA database')

function commitFixture() {
  const prefix = crypto.randomUUID().slice(0, 4)
  const ids = {}
  for (const [name, digit] of Object.entries({ actor: 1, customer: 2, worker: 3, team: 4, route: 5, order: 6 }))
    ids[name] = `${prefix}${digit}000-0000-0000-0000-000000000001`
  ids.worker2 = ids.worker.slice(0, -1) + '2'
  ids.team2 = ids.team.slice(0, -1) + '2'
  ids.route2 = ids.route.slice(0, -1) + '2'
  ids.order2 = ids.order.slice(0, -1) + '2'
  let fixture = readFileSync(fileURLToPath(new URL('./tests/order-lifecycle.sql', import.meta.url)), 'utf8').split('-- Legacy conflicting history')[0]
  for (let digit = 1; digit <= 6; digit++) fixture = fixture.replaceAll(`a${digit}000000`, `${prefix}${digit}000`)
  fixture = fixture.replaceAll('QA-LIFECYCLE', `QA-COMMIT-${prefix}`)
  fixture = fixture.replaceAll('a-qa-customer', `${prefix}-qa-customer`)
  fixture += `insert into public.workers(id,name,phone,hire_date) values('${ids.worker2}','QA Other Worker','synthetic',current_date);
    insert into public.team_members(team_id,worker_id,joined_at) values('${ids.team2}','${ids.worker2}',clock_timestamp()-interval '1 day');
    update public.teams set leader_id='${ids.worker2}' where id='${ids.team2}';
    set local role authenticated; select set_config('request.jwt.claim.sub','${ids.actor}',true);
    select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','${ids.route}',
     'expected',public.lifecycle_snapshot('route','${ids.route}'),'desired',jsonb_build_array(jsonb_build_object(
     'order_id','${ids.order}','sequence_order',1,'expected',public.lifecycle_snapshot('order','${ids.order}')))));
    select public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','save','route_id','${ids.route2}',
     'expected',public.lifecycle_snapshot('route','${ids.route2}'),'desired',jsonb_build_array(jsonb_build_object(
     'order_id','${ids.order2}','sequence_order',1,'expected',public.lifecycle_snapshot('order','${ids.order2}'))))); commit;`
  sql(fixture)
  return ids
}
function startFresh(ids) {
  return `perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','start','order_id','${ids.order}',
    'expected',public.lifecycle_snapshot('order','${ids.order}')));`
}
function teamFresh(ids) {
  return `perform public.lifecycle_mutate(gen_random_uuid(),jsonb_build_object('op','route_update','route_id','${ids.route}',
    'expected',public.lifecycle_snapshot('route','${ids.route}'),'data',jsonb_build_object('team_id','${ids.team2}')));`
}
function leave(ids) {
  return `update public.team_members set left_at=clock_timestamp() where worker_id='${ids.worker}' and team_id='${ids.team}';`
}
async function commitPair(name, ids, first, second) {
  const claimFor = `set local role authenticated; select set_config('request.jwt.claim.sub','${ids.actor}',true);`
  const held = session(`begin; set local lock_timeout='5s'; ${claimFor} ${first}\n\\echo QA_LOCK_HELD\nselect pg_sleep(1.5); commit;`, 'QA_LOCK_HELD')
  await held.ready
  const before = performance.now()
  const contender = session(`begin; set local lock_timeout='5s'; ${claimFor} ${second} commit;`)
  await Promise.all([held.done, contender.done])
  assert.ok(performance.now() - before >= 900, `${name}: no serialized wait`)
  console.log(`PASS ${name}: committed serial order and postconditions verified`)
}
{
  const ids = commitFixture()
  await commitPair('team change commits before start', ids, `do $$ begin ${teamFresh(ids)} end $$;`,
    `do $$ begin ${startFresh(ids)}
      if not exists(select 1 from public.order_workers where order_id='${ids.order}' and worker_id='${ids.worker2}' and team_id='${ids.team2}' and role='leader')
      or exists(select 1 from public.order_workers where order_id='${ids.order}' and worker_id='${ids.worker}') then raise exception 'TEST wrong team participants'; end if; end $$;`)
}
{
  const ids = commitFixture()
  await commitPair('start commits before team change', ids, `do $$ begin ${startFresh(ids)} end $$;`,
    `do $$ begin begin ${teamFresh(ids)} raise exception 'TEST team changed after start';
      exception when others then if SQLERRM<>'LC_HISTORY' then raise; end if; end;
      if not exists(select 1 from public.orders where id='${ids.order}' and team_id='${ids.team}' and status='in_progress') then raise exception 'TEST original context lost'; end if; end $$;`)
}
{
  const ids = commitFixture()
  await commitPair('member leave commits before start', ids, leave(ids),
    `do $$ begin begin ${startFresh(ids)} raise exception 'TEST empty team started';
      exception when others then if SQLERRM<>'LC_MEMBERS' then raise; end if; end;
      if exists(select 1 from public.order_workers where order_id='${ids.order}') or exists(select 1 from public.order_status_logs where order_id='${ids.order}' and status='in_progress')
      or not exists(select 1 from public.orders where id='${ids.order}' and status='scheduled') then raise exception 'TEST partial empty team start'; end if; end $$;`)
}
{
  const ids = commitFixture()
  await commitPair('start commits before member leave', ids, `do $$ begin ${startFresh(ids)} end $$;`,
    `${leave(ids)} do $$ begin
      if (select count(*) from public.order_workers where order_id='${ids.order}')<>1 or not exists(
       select 1 from public.order_workers w join public.order_status_logs l on l.order_id=w.order_id
       where w.order_id='${ids.order}' and w.worker_id='${ids.worker}' and w.role='leader' and w.started_at=l.created_at
       and w.finished_at is not null and w.finished_at>=w.started_at and l.status='in_progress') then raise exception 'TEST participation history/leave semantics'; end if; end $$;`)
}
console.log('Committed concurrency fixtures are synthetic and remain for review; retire dedicated QA database after qualification.')

// Direct SQL can lock a lifecycle row BEFORE entering the statement guard.
// Demonstrate the documented inversion and victim rollback instead of claiming
// the advisory lock eliminates every possible deadlock.
function interactive(initial, marker) {
  let output = '', errors = ''
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] })
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  child.stdout.on('data', data => { output += data; if (output.includes(marker)) resolveReady() })
  child.stderr.on('data', data => { errors += data })
  const done = new Promise(resolve => child.on('close', code => {
    if (!output.includes(marker)) rejectReady(new Error(`Interactive session closed before marker: ${errors}`))
    resolve({ code, output, errors })
  }))
  child.stdin.write(initial)
  return { child, ready, done }
}
const inversionA = interactive(`begin; set local lock_timeout='5s'; ${claim}
 select id from public.orders where id='${order1}' for update;\n\\echo QA_ROW_HELD\n`, 'QA_ROW_HELD')
await inversionA.ready
const inversionB = interactive(`begin; set local lock_timeout='5s'; ${claim}
 select pg_advisory_xact_lock(61006,1);\n\\echo QA_GLOBAL_HELD\n`, 'QA_GLOBAL_HELD')
await inversionB.ready
inversionB.child.stdin.end(`${start} rollback;`)
inversionA.child.stdin.end(`update public.orders set confirmation_notes='QA uncommitted inversion' where id='${order1}'; rollback;`)
const inversion = await Promise.all([inversionA.done, inversionB.done])
assert.equal(inversion.filter(result => result.errors.includes('deadlock detected')).length, 1)
assert.equal(inversion.filter(result => result.code === 0).length, 1)
assert.deepEqual(snapshot('order', order1), o1)
console.log('PASS deliberate row-before-advisory deadlock: one victim aborted, winner rolled back, original order unchanged')

{
  const ids = commitFixture()
  const source1 = snapshot('route', ids.route), source2 = snapshot('route', ids.route2)
  const original1 = snapshot('order', ids.order), original2 = snapshot('order', ids.order2)
  const firstMove = mutation({ op: 'transfer', route_id: ids.route, destination_id: ids.route2, order_id: ids.order,
    link_id: source1.links[0].id, expected: source1, destination_expected: source2, order_expected: original1 })
  const secondMove = mutation({ op: 'transfer', route_id: ids.route2, destination_id: ids.route, order_id: ids.order2,
    link_id: source2.links[0].id, expected: source2, destination_expected: source1, order_expected: original2 }).replace(/^select /, 'perform ')
  await commitPair('opposing transfers with stale captured versions', ids, firstMove,
    `do $$ begin begin ${secondMove} raise exception 'TEST stale opposing transfer accepted';
      exception when others then if SQLERRM<>'LC_CONFLICT' then raise; end if; end;
      if not exists(select 1 from public.route_orders where order_id='${ids.order}' and route_id='${ids.route2}')
       or not exists(select 1 from public.route_orders where order_id='${ids.order2}' and route_id='${ids.route2}')
       or exists(select 1 from public.route_orders where route_id='${ids.route}') then raise exception 'TEST partial opposing transfer'; end if; end $$;`)
  assert.deepEqual(snapshot('order', ids.order2).links.map(link => link.id), original2.links.map(link => link.id))
}
