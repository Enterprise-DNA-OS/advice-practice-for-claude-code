#!/usr/bin/env node
// npm test: a temp database, migrate, seed, every command, the rules and the gates. Prints PASS.
// TEST_DATABASE_URL runs the same checks against a real, empty, disposable Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, commands, resolve, date, amount, human } from './advice.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advice-test-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = dir;

let db;
const visited = new Set();
const call = (c, o = {}, p = []) => {
  visited.add(c);
  return run(db, [c, ...p, ...Object.entries(o).map(([k, v]) => (v === true ? `--${k}` : `--${k}=${v}`))]);
};
const fails = (c, o, re, p = []) => assert.rejects(() => call(c, o, p), re);
const shell = (file, argv = []) => {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', file), ...argv], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.stdout;
};
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const actor = { actor: 'Test Operator' };

try {
  db = await getDb();
  if (db.mode === 'postgres') assert.equal((await db.query("select tablename from pg_tables where schemaname = 'public'")).length, 0, 'TEST_DATABASE_URL must be an empty, disposable database');
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0, 'migrate is safe to rerun');
  await seed(db); await seed(db);
  assert.equal((await call('clients')).length, 12, 'seed is idempotent');

  // Every read runs and returns rows or a report.
  for (const c of ['help', 'advisers', 'clients', 'reviews-due', 'consents-due', 'fee-book', 'pipeline', 'complaints', 'cpd', 'attention', 'compliance', 'file-notes']) {
    assert(Array.isArray(await call(c)), c);
  }
  assert.equal((await call('clients', { adviser: 'MW' })).length, 3);
  assert.equal((await call('clients', { status: 'prospect' })).length, 1);

  // The seeded problems are found, every time.
  const rules = (await call('compliance')).map((r) => `${r.rule} ${r.record}`);
  for (const want of ['AU-OFA-LAPSED OFA-1001', 'AU-OFA-WINDOW OFA-1003', 'AU-OFA-CONTENT OFA-1004', 'POLICY-SERVICE C-1005', 'POLICY-SERVICE C-1007',
    'AU-SOA-BASIS A-2004', 'NZ-DISCLOSURE A-2003', 'AU-IDR-ACK K-302', 'AU-IDR-30 K-301', 'AU-CPD SR', 'POLICY-NZ-CPD MW']) assert(rules.includes(want), `compliance finds ${want}`);
  assert(!rules.some((r) => r.endsWith('OFA-1010')), 'a complete, current consent is clean');
  assert(!rules.some((r) => r.startsWith('AU-IDR') && r.endsWith('K-303')), 'NZ complaints are not held to the AU clock');

  const consents = await call('consents-due');
  assert.equal(consents.find((r) => r.reference === 'OFA-1001').window_state, 'lapsed');
  assert.equal(consents.find((r) => r.reference === 'OFA-1003').days_left, 30);
  assert(!consents.some((r) => r.reference === 'OFA-1010'));
  const reviews = await call('reviews-due');
  assert.equal(reviews.find((r) => r.reference === 'C-1005').days_overdue, 135);
  assert(!reviews.some((r) => r.reference === 'C-1012'), 'ceased clients are not due');
  const book = await call('fee-book');
  const sr = book.find((r) => r.adviser === 'SR');
  assert.equal(Number(sr.annual_fees), 18700); assert.equal(Number(sr.lapsed), 4400);
  assert.equal(Number(book.find((r) => r.adviser === 'MW').annual_fees), 4200);
  assert.equal((await call('pipeline', { stuck: '21' })).length, 3);
  assert.equal((await call('complaints', { open: true })).length, 3);
  assert.equal(Number((await call('cpd')).find((r) => r.code === 'SR').hours_short), 9);
  const attention = await call('attention');
  assert(attention.some((r) => r.kind === 'quiet' && r.record === 'C-1006'));
  assert(attention.some((r) => r.kind === 'consent' && r.record === 'OFA-1001'));
  const weekly = await call('weekly-review');
  assert.deepEqual(Object.keys(weekly), ['consents-due', 'reviews-due', 'pipeline (stuck 21 days or more)', 'complaints (open)', 'compliance']);
  assert.match(human(weekly), /OFA-1001/);

  // Matching: reference, id, part of a name; ambiguous lists the candidates.
  assert.equal((await call('client', { client: 'c-1001' })).client.name, 'Robert and Ann Fielding');
  assert.equal((await call('client', { client: 'fielding' })).fee_arrangements[0].reference, 'OFA-1001');
  assert.equal((await resolve(db, 'clients', 'c0000000-0000-0000-0000-000000000002')).reference, 'C-1002');
  assert.equal((await resolve(db, 'fee_arrangements', 'Margaret')).reference, 'OFA-1003');
  await assert.rejects(() => resolve(db, 'clients', 'and'), /more than one[\s\S]*C-1001[\s\S]*C-1002/);
  await assert.rejects(() => resolve(db, 'clients', "%' or true --"), /No clients/);

  // Input checks.
  assert.equal(date('14/03/2025'), '2025-03-14');
  assert.throws(() => date('2026-02-30'), /real date/); assert.throws(() => date('03/14/2025'), /real date/);
  assert.equal(amount('$4,400'), '4400'); assert.throws(() => amount('-1'), /positive/);
  await fails('reviews-due', { days: '-1' }, /whole number/);
  await fails('clients', { typo: 'x' }, /Unknown option/);
  await fails('complaints', { open: 'yes' }, /takes no value/);
  await fails('log', { client: 'C-1001', note: 'x' }, /--actor is required/);

  // Writes: adviser, client, review, arrangement, consent window, end.
  await call('add-adviser', { code: 'KB', name: 'Kate Bell', jurisdiction: 'AU', 'cpd-year-starts': iso(-10), ...actor });
  await call('add-client', { reference: 'T-1', name: 'Test <script>Client</script>', adviser: 'KB', jurisdiction: 'AU', package: 'Gold', ...actor });
  await fails('add-client', { reference: 't-1', name: 'Dup', adviser: 'KB', jurisdiction: 'AU', ...actor }, /unique|duplicate/);
  await call('update-client', { client: 'T-1', package: 'Silver', 'review-months': '6', ...actor });
  assert.equal((await call('client', { client: 'T-1' })).client.service_package, 'Silver');
  await fails('record-review', { client: 'T-1', summary: 'x', date: iso(5), ...actor }, /before it is held/);
  await call('record-review', { client: 'T-1', summary: 'First review', ...actor });
  assert.equal((await call('client', { client: 'T-1' })).client.last_review_on, iso(0));
  await call('add-arrangement', { client: 'T-1', reference: 'OFA-T1', 'annual-fee': '2,200', services: 'Annual review, one check-in', accounts: 'Account ending 0001', 'reference-day': iso(100), ...actor });
  await fails('record-consent', { arrangement: 'OFA-T1', document: 'x', shows: 'services', ...actor }, /window is not open/);
  await call('record-consent', { arrangement: 'OFA-1003', document: 'demo://k.pdf', shows: 'services,accounts,termination', ...actor });
  assert(!(await call('compliance')).some((r) => r.record === 'OFA-1003'), 'a signed consent clears the window finding');
  assert.equal((await call('client', { client: 'C-1003' })).fee_arrangements[0].window_state, 'not open', 'the reference day rolls on a year');
  await fails('record-consent', { arrangement: 'OFA-1001', document: 'x', shows: 'services', ...actor }, /lapsed/);
  const partial = await call('record-consent', { arrangement: 'OFA-1002', document: 'demo://p.pdf', shows: 'services', ...actor });
  assert.match(partial.warning, /accounts, termination/);
  assert((await call('compliance')).some((r) => r.rule === 'AU-OFA-CONTENT' && r.record === 'OFA-1002'));
  await fails('record-consent', { arrangement: 'OFA-1005', document: 'x', shows: 'services,spaceship', ...actor }, /--shows item/);
  await call('end-arrangement', { arrangement: 'OFA-1001', reason: 'No consent within the window', ...actor });
  assert(!(await call('compliance')).some((r) => r.record === 'OFA-1001'), 'ending a lapsed arrangement clears it');
  await fails('end-arrangement', { arrangement: 'OFA-1001', reason: 'again', ...actor }, /already ended/);

  // Advice files: the presentation gate.
  await call('add-advice', { client: 'T-1', reference: 'A-T1', topic: 'Super contributions', kind: 'SOA', fee: '1100', ...actor });
  await fails('add-advice', { client: 'T-1', reference: 'A-T2', topic: 'x', kind: 'letter', ...actor }, /kind must be/);
  await fails('move-advice', { advice: 'A-T1', stage: 'presented', ...actor }, /scope[\s\S]*reasons/);
  await fails('move-advice', { advice: 'A-T1', stage: 'implemented', scope: 's', reasons: 'r', ...actor }, /not been presented/);
  await call('move-advice', { advice: 'A-T1', stage: 'presented', scope: 'Contributions only', reasons: 'Uses the unused cap before it expires', ...actor });
  await call('move-advice', { advice: 'A-T1', stage: 'implemented', ...actor });
  await fails('move-advice', { advice: 'A-2006', stage: 'presented', scope: 's', reasons: 'r', ...actor }, /--disclosure/);
  await call('move-advice', { advice: 'A-2004', stage: 'presented', reasons: 'Keeps the home while the bond is paid from savings', ...actor });
  assert(!(await call('compliance')).some((r) => r.record === 'A-2004'));

  // Complaints, CPD, file notes.
  await call('add-complaint', { client: 'T-1', reference: 'K-T1', summary: 'Late call back', ...actor });
  await call('acknowledge-complaint', { complaint: 'K-T1', ...actor });
  await fails('acknowledge-complaint', { complaint: 'K-T1', ...actor }, /was acknowledged/);
  await fails('respond-complaint', { complaint: 'K-T1', ...actor }, /--outcome is required/);
  await call('respond-complaint', { complaint: 'K-301', outcome: 'Fee refunded for the year without a review', ...actor });
  assert(!(await call('compliance')).some((r) => r.record === 'K-301'));
  await call('add-cpd', { adviser: 'SR', hours: '9', category: 'regulatory', activity: 'Licensee compliance day', ...actor });
  await fails('add-cpd', { adviser: 'SR', hours: '50', category: 'ethics', activity: 'x', ...actor }, /at most 40/);
  await call('add-cpd', { adviser: 'MW', hours: '2', category: 'general', activity: 'Reading', 'non-qualifying': true, ...actor });
  assert(!(await call('compliance')).some((r) => r.record === 'SR' || r.record === 'MW'));
  await call('log', { client: 'C-1006', note: 'Called about the review', kind: 'call', ...actor });
  assert.equal((await call('file-notes', { client: 'C-1006', limit: '5' }))[0].note, 'Called about the review');

  // Drafts go to drafts/, never anywhere else.
  const invite = await call('draft-review-invite', { client: 'C-1002' });
  assert.match(fs.readFileSync(invite.file, 'utf8'), /DRAFT[\s\S]*Retirement income plan/);
  const consent = await call('draft-consent', { arrangement: 'OFA-1005' });
  const consentText = fs.readFileSync(consent.file, 'utf8');
  assert.match(consentText, /super check[\s\S]*account ending 5505[\s\S]*arrangement ends/i);
  assert.equal(path.dirname(consent.file), path.join(dir, 'drafts'));

  // Import from the Xplan client list: dry run, real run, rerun, changed source.
  const fixture = path.join(REPO_ROOT, 'fixtures', 'xplan-client-list.csv');
  const dry = await call('import', { file: fixture, 'dry-run': true, ...actor }, ['xplan']);
  assert.equal(dry.added, 4); assert.equal((await call('clients')).length, 13, 'dry run writes nothing');
  const real = await call('import', { file: fixture, ...actor }, ['xplan']);
  assert.equal(real.added, 4); assert.match(real.advisers_added, /DK Daniel Kerr/);
  const moore = await call('client', { client: 'X-40312' });
  assert.equal(moore.client.last_review_on, '2025-11-30'); assert.equal(moore.client.adviser, 'Daniel Kerr');
  assert.equal((await call('client', { client: 'X-40311' })).client.name, 'Nguyen, Linh and Bao');
  assert.equal((await call('client', { client: 'X-40314' })).client.status, 'ceased');
  assert.equal((await call('import', { file: fixture, ...actor }, ['xplan'])).unchanged, 4, 'reimport is a no-op');
  const changed = path.join(dir, 'changed.csv');
  fs.writeFileSync(changed, fs.readFileSync(fixture, 'utf8').replace('Patricia Moore', 'Patricia Moore-Hall'));
  await fails('import', { file: changed, ...actor }, /changed in Xplan/, ['xplan']);
  const mapped = path.join(dir, 'mapped.csv'); const map = path.join(dir, 'map.json');
  fs.writeFileSync(mapped, 'Ref,Household,Owner\n9001,Te Aho Whanau,Mere Walker\n');
  fs.writeFileSync(map, JSON.stringify({ source_id: 'Ref', name: 'Household', adviser: 'Owner' }));
  assert.equal((await call('import', { file: mapped, map, jurisdiction: 'NZ', ...actor }, ['xplan'])).added, 1);
  fs.writeFileSync(map, JSON.stringify({ source_id: 'Nope' }));
  await fails('import', { file: mapped, map, ...actor }, /not in the file/, ['xplan']);
  const badStatus = path.join(dir, 'bad.csv');
  fs.writeFileSync(badStatus, 'Client ID,Client Name,Client Status\n1,A,Sleeping\n');
  await fails('import', { file: badStatus, ...actor }, /status "Sleeping"/, ['xplan']);
  await fails('import', { file: fixture, ...actor }, /Supported import: xplan/, ['iress']);

  // Export.
  const exp = await call('export');
  const backup = JSON.parse(fs.readFileSync(exp.file, 'utf8'));
  assert.equal(backup.records.clients.length, 18);
  assert.equal(backup.records.clients.find((c) => c.source_id === '40312').source_row['Client Name'], 'Patricia Moore');

  for (const c of Object.keys(commands)) assert(visited.has(c), `smoke test covers ${c}`);
  assert.match(human(await call('help')), /consents-due/);
  await db.close(); db = null;

  // The HTML views and documents render from the same database (embedded mode only).
  if (!process.env.DATABASE_URL) {
    assert.match(shell('view.mjs'), /views[\\/]week\.html/);
    const week = fs.readFileSync(path.join(dir, 'views', 'week.html'), 'utf8');
    assert.match(week, /OFA-1005|C-1005/); assert(!week.includes('<script>Client'), 'views escape text');
    const docs = shell('docs.mjs');
    assert.match(docs, /consent-form/); assert.match(docs, /review-summary/); assert.match(docs, /complaints-register/);
    assert.match(shell('advice.mjs', ['consents-due']), /window_state/);
    assert.match(shell('advice.mjs', ['compliance', '--json']), /"rule"/);
  }
  console.log(`PASS: ${Object.keys(commands).length} commands checked (${process.env.DATABASE_URL ? 'postgres' : 'pglite'})`);
} finally {
  if (db) await db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
