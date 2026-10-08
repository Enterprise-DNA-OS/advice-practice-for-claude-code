#!/usr/bin/env node
// The one CLI for Advice Practice for Claude Code. Every slash command drives this.
//   npm run advice -- help
//   npm run advice -- consents-due --days=60
//   npm run advice -- client --client=fielding --json
// Human tables by default, --json for machines. Records match by id, id prefix,
// reference or part of a name; an ambiguous match lists the candidates and exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

export const commands = {
  help: 'Show commands',
  advisers: 'Advisers, paraplanners and admin staff',
  clients: 'Client households: optional --adviser --status=active|prospect|ceased',
  client: 'One client and everything on file: --client',
  'reviews-due': 'Reviews due or overdue: --days=30 (look ahead)',
  'consents-due': 'Ongoing fee arrangements by consent window: --days=60 (closing within)',
  'fee-book': 'Ongoing fee revenue by adviser and currency, with the share at risk',
  pipeline: 'Advice files in progress by stage: optional --stuck=21 (days in stage)',
  complaints: 'Complaints with their clocks: optional --open',
  cpd: 'CPD hours this CPD year by adviser and category',
  attention: 'Everything late, lapsing, stuck or quiet in one list',
  compliance: 'Every rule in docs/compliance.md checked against the records',
  'weekly-review': 'Reviews, consents, pipeline, complaints and compliance in one report',
  'file-notes': 'File notes, newest first: optional --client --limit=30',
  'add-adviser': '--code --name --jurisdiction=AU|NZ --actor; optional --role --registration --cpd-year-starts',
  'add-client': '--reference --name --adviser --jurisdiction=AU|NZ --actor; optional --kind --status --package --review-months --last-review --since --email --phone',
  'update-client': '--client --actor with changed fields (--name --adviser --status --package --review-months --email --phone)',
  'record-review': '--client --summary --actor; optional --date --kind=annual|interim|event --actions --adviser',
  'add-arrangement': '--client --reference --annual-fee --services --reference-day --actor; optional --currency --accounts --entered',
  'record-consent': '--arrangement --document --shows=services,accounts,termination --actor; optional --date --next-reference-day',
  'end-arrangement': '--arrangement --reason --actor; optional --date',
  'add-advice': '--client --reference --topic --kind=SOA|ROA|"advice record" --actor; optional --prepared-by --scope --fee',
  'move-advice': '--advice --stage --actor; optional --scope --reasons --disclosure --date',
  log: 'File note: --client --note --actor; optional --kind=note|call|email|meeting',
  'add-complaint': '--client --reference --summary --actor; optional --received',
  'acknowledge-complaint': '--complaint --actor; optional --date',
  'respond-complaint': '--complaint --outcome --actor; optional --date',
  'add-cpd': '--adviser --hours --category --activity --actor; optional --date --non-qualifying',
  'draft-review-invite': 'Annual review invitation to drafts/: --client',
  'draft-consent': 'Ongoing fee renewal consent to drafts/: --arrangement',
  import: 'xplan --file=client-list.csv --actor; optional --map=columns.json --dry-run --jurisdiction=AU|NZ',
  export: 'Every record, with original imported fields, to a JSON backup',
};

const STAGES = ['fact find', 'research', 'drafting', 'compliance check', 'presented', 'implemented', 'declined'];
const CPD_CATEGORIES = ['technical', 'client care', 'regulatory', 'ethics', 'tax', 'general'];
const TABLES = ['advisers', 'clients', 'fee_arrangements', 'consents', 'advice_files', 'reviews', 'complaints', 'cpd', 'file_notes'];

// ---------------------------------------------------------------- input checks

const today = () => new Date().toISOString().slice(0, 10);
function required(o, k) {
  if (typeof o[k] !== 'string' || !o[k].trim()) throw Error(`--${k} is required`);
  return o[k].trim();
}
export function date(value, label = 'date', nullable = true) {
  if ((value === undefined || value === null || value === '') && nullable) return null;
  let s = String(value ?? '').trim();
  const au = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // AU and NZ write day first
  if (au) s = `${au[3]}-${au[2].padStart(2, '0')}-${au[1].padStart(2, '0')}`;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s) {
    throw Error(`${label} must be a real date (YYYY-MM-DD or DD/MM/YYYY), got "${value}"`);
  }
  return s;
}
const safeDate = (value, label) => date(value, label);
export function amount(v, label = 'amount') {
  const s = String(v ?? '').replace(/[$,\s]/g, '');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) throw Error(`${label} must be a positive amount with at most two decimals`);
  return s;
}
function oneOf(v, choices, label) {
  if (!choices.includes(v)) throw Error(`${label} must be one of: ${choices.join(', ')}`);
  return v;
}
function intIn(v, lo, hi, label) {
  if (!/^\d+$/.test(String(v)) || Number(v) < lo || Number(v) > hi) throw Error(`${label} must be a whole number from ${lo} to ${hi}`);
  return Number(v);
}
function args(argv) {
  const o = {}; const p = [];
  for (const a of argv) {
    if (!a.startsWith('--')) { p.push(a); continue; }
    const i = a.indexOf('=');
    const k = a.slice(2, i < 0 ? undefined : i);
    if (Object.hasOwn(o, k)) throw Error(`Repeated --${k}`);
    o[k] = i < 0 ? true : a.slice(i + 1);
  }
  return { o, p };
}

// ---------------------------------------------------------------- record matching

const LOOKUP = {
  advisers: { label: 'name', key: 'code' },
  clients: { label: 'name', key: 'reference' },
  fee_arrangements: { label: 'services', key: 'reference', join: 'clients' },
  advice_files: { label: 'topic', key: 'reference', join: 'clients' },
  complaints: { label: 'summary', key: 'reference', join: 'clients' },
};
// Exact id or reference first; then id prefix, or part of the name (for arrangements, advice
// files and complaints, part of the client's name too). More than one hit lists them all.
export async function resolve(db, kind, search) {
  const spec = LOOKUP[kind];
  if (!spec) throw Error('Unknown record type');
  if (typeof search !== 'string' || !search.trim()) throw Error('A record reference is required');
  const s = search.trim();
  const exact = await db.query(`select * from ${kind} where id::text = $1 or lower(${spec.key}) = lower($1)`, [s]);
  if (exact.length === 1) return exact[0];
  const clientName = spec.join ? ` or strpos(lower((select c.name from clients c where c.id = t.client_id)), lower($1)) > 0` : '';
  const rows = await db.query(
    `select t.* from ${kind} t where starts_with(t.id::text, lower($1)) or strpos(lower(t.${spec.label}), lower($1)) > 0${clientName} order by t.${spec.key}`, [s]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw Error(`No ${kind.replace('_', ' ')} matches "${s}"`);
  throw Error(`"${s}" matches more than one:\n${rows.map((r) => `  ${r[spec.key]}  ${r[spec.label]}`).join('\n')}\nUse the reference.`);
}

async function note(db, clientId, author, kind, text) {
  await db.query('insert into file_notes (client_id, author, kind, note) values ($1, $2, $3, $4)', [clientId, author, kind, text]);
}
async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const r = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return r; } catch (e) { await db.exec('rollback'); throw e; }
}
async function insert(db, kind, data) {
  const keys = Object.keys(data);
  return (await db.query(`insert into ${kind} (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(data)))[0];
}
function writeDraft(name, text) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${randomUUID().slice(0, 8)}.md`);
  fs.writeFileSync(file, text, { flag: 'wx' });
  return file;
}

// ---------------------------------------------------------------- reads

const READS = {
  advisers: (db) => db.query('select code, name, role, jurisdiction, registration, cpd_year_starts, active from advisers order by active desc, code'),

  async clients(db, o) {
    const where = []; const vals = [];
    if (o.adviser) { vals.push((await resolve(db, 'advisers', o.adviser)).id); where.push(`c.adviser_id = $${vals.length}`); }
    if (o.status) { vals.push(oneOf(o.status, ['active', 'prospect', 'ceased'], 'status')); where.push(`c.status = $${vals.length}`); }
    return db.query(`select c.reference, c.name, a.code as adviser, c.jurisdiction, c.status, c.service_package as package, c.last_review_on,
      (select count(*)::int from fee_arrangements f where f.client_id = c.id and f.status = 'active') as fee_arrangements
      from clients c left join advisers a on a.id = c.adviser_id ${where.length ? `where ${where.join(' and ')}` : ''} order by c.reference`, vals);
  },

  async client(db, o) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const one = (sql) => db.query(sql, [c.id]);
    return {
      client: (await one(`select c.reference, c.name, c.kind, a.name as adviser, c.jurisdiction, c.status, c.service_package, c.review_months,
        c.last_review_on, c.client_since, c.email, c.phone from clients c left join advisers a on a.id = c.adviser_id where c.id = $1`))[0],
      fee_arrangements: await one(`select w.reference, w.annual_fee, w.currency, w.reference_day, w.terminates_on, w.window_state, w.last_consent
        from consent_windows w join fee_arrangements f on f.id = w.id where f.client_id = $1`),
      advice: await one('select reference, topic, document_kind, stage, stage_since, presented_on, implemented_on from advice_files where client_id = $1 order by created_at'),
      reviews: await one('select held_on, kind, summary, actions from reviews where client_id = $1 order by held_on desc'),
      complaints: await one('select reference, received_on, summary, acknowledged_on, responded_on, outcome from complaints where client_id = $1 order by received_on desc'),
      file_notes: await one(`select created_at::date as on_date, author, kind, note from file_notes where client_id = $1 order by created_at desc limit 20`),
    };
  },

  'reviews-due': (db, o) => db.query(`select reference, name, adviser, jurisdiction, service_package as package, last_review_on, due_on, days_overdue,
      pays_ongoing_fee as fee, last_contact from review_schedule where due_on <= current_date + $1::int order by due_on, reference`,
    [intIn(o.days ?? '30', 0, 730, '--days')]),

  'consents-due': (db, o) => db.query(`select reference, client, adviser, jurisdiction, annual_fee, currency, window_opens, reference_day, terminates_on,
      window_state, days_left, last_consent from consent_windows
      where window_state = 'lapsed' or (window_state = 'open' and (last_consent is null or last_consent < window_opens) and days_left <= $1::int)
         or (window_state = 'not open' and window_opens <= current_date + 30)
      order by terminates_on, reference`, [intIn(o.days ?? '60', 0, 400, '--days')]),

  'fee-book': (db) => db.query(`select coalesce(w.adviser, '(none)') as adviser, w.currency, count(*)::int as arrangements,
      sum(w.annual_fee) as annual_fees,
      coalesce(sum(w.annual_fee) filter (where w.window_state = 'lapsed'), 0) as lapsed,
      coalesce(sum(w.annual_fee) filter (where w.window_state = 'open' and w.days_left <= 45 and (w.last_consent is null or w.last_consent < w.window_opens)), 0) as closing_45d,
      coalesce(sum(w.annual_fee) filter (where r.days_overdue > 30), 0) as review_overdue
    from consent_windows w join fee_arrangements f on f.id = w.id left join review_schedule r on r.id = f.client_id
    group by 1, 2 order by 2, 1`),

  pipeline: (db, o) => db.query(`select reference, client, adviser, topic, document_kind as kind, stage, stage_since, days_in_stage, prepared_by, advice_fee
      from advice_pipeline where days_in_stage >= $1::int
      order by array_position(array['fact find','research','drafting','compliance check','presented'], stage), days_in_stage desc`,
    [intIn(o.stuck ?? '0', 0, 3650, '--stuck')]),

  complaints: (db, o) => db.query(`select k.reference, c.name as client, c.jurisdiction, k.received_on, k.acknowledged_on, k.responded_on,
      case when k.responded_on is null then current_date - k.received_on end as days_open,
      case when k.responded_on is null then case c.jurisdiction when 'AU' then 30 else 20 end - (current_date - k.received_on) end as days_to_deadline,
      k.summary from complaints k join clients c on c.id = k.client_id
      ${o.open ? 'where k.responded_on is null' : ''} order by k.responded_on nulls first, k.received_on`),

  cpd: (db) => db.query(`select code, name, jurisdiction, cpd_year_ends, days_left, total_hours, qualifying_hours, technical, client_care, regulatory, ethics,
      case when jurisdiction = 'AU' then greatest(0, 40 - total_hours) end as hours_short from cpd_progress order by days_left, code`),

  attention: (db) => db.query(`
    select 'consent' as kind, reference as record, client, adviser,
      case window_state when 'lapsed' then 'Lapsed: no consent, the fee must stop' else format('Consent window closes in %s days', days_left) end as why, days_left as days
      from consent_windows where window_state = 'lapsed' or (window_state = 'open' and days_left <= 45 and (last_consent is null or last_consent < window_opens))
    union all select 'review', reference, name, adviser, format('Review %s days overdue%s', days_overdue, case when pays_ongoing_fee then ', paying an ongoing fee' else '' end), -days_overdue
      from review_schedule where days_overdue > 0
    union all select 'advice', reference, client, adviser, format('%s for %s days', stage, days_in_stage), -days_in_stage
      from advice_pipeline where days_in_stage > 21
    union all select 'complaint', k.reference, c.name, a.code,
      case when k.acknowledged_on is null then 'Not acknowledged' else format('Open %s days', current_date - k.received_on) end, -(current_date - k.received_on)
      from complaints k join clients c on c.id = k.client_id left join advisers a on a.id = c.adviser_id where k.responded_on is null
    union all select 'quiet', reference, name, adviser,
      case when last_contact is null then 'Pays an ongoing fee, no file note on record' else format('Pays an ongoing fee, no file note for %s days', current_date - last_contact) end,
      -(current_date - last_contact)
      from review_schedule where pays_ongoing_fee and (last_contact is null or last_contact < current_date - 90)
    order by days nulls first, kind, record`),

  compliance: (db) => db.query('select rule, record, client, finding from compliance_findings order by severity, rule, record'),

  async 'file-notes'(db, o) {
    const c = o.client ? await resolve(db, 'clients', o.client) : null;
    return db.query(`select n.created_at::date as on_date, c.reference, c.name as client, n.author, n.kind, n.note from file_notes n join clients c on c.id = n.client_id
      ${c ? 'where c.id = $2' : ''} order by n.created_at desc, n.id limit $1::int`, c ? [intIn(o.limit ?? '30', 1, 1000, '--limit'), c.id] : [intIn(o.limit ?? '30', 1, 1000, '--limit')]);
  },

  async 'weekly-review'(db) {
    return {
      'consents-due': await READS['consents-due'](db, { days: '45' }),
      'reviews-due': await READS['reviews-due'](db, { days: '14' }),
      'pipeline (stuck 21 days or more)': await READS.pipeline(db, { stuck: '21' }),
      'complaints (open)': await READS.complaints(db, { open: true }),
      compliance: await READS.compliance(db),
    };
  },
};

// ---------------------------------------------------------------- writes

const CLIENT_FIELDS = { name: 'name', kind: 'kind', status: 'status', package: 'service_package', 'review-months': 'review_months', email: 'email', phone: 'phone' };
function clientFields(o) {
  const data = {};
  for (const [flag, col] of Object.entries(CLIENT_FIELDS)) {
    if (!Object.hasOwn(o, flag)) continue;
    let v = o[flag];
    if (typeof v !== 'string') throw Error(`--${flag} needs a value`);
    if (flag === 'kind') v = oneOf(v, ['individual', 'couple', 'family', 'entity'], 'kind');
    if (flag === 'status') v = oneOf(v, ['prospect', 'active', 'ceased'], 'status');
    if (flag === 'review-months') v = intIn(v, 1, 36, '--review-months');
    data[col] = v;
  }
  return data;
}

const WRITES = {
  async 'add-adviser'(db, o) {
    const code = required(o, 'code').toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(code)) throw Error('--code is two to four letters, usually initials');
    return insert(db, 'advisers', {
      code, name: required(o, 'name'), jurisdiction: oneOf(required(o, 'jurisdiction'), ['AU', 'NZ'], 'jurisdiction'),
      role: oneOf(o.role ?? 'adviser', ['adviser', 'paraplanner', 'admin'], 'role'), registration: o.registration ?? '',
      cpd_year_starts: safeDate(o['cpd-year-starts'], '--cpd-year-starts'),
    });
  },

  async 'add-client'(db, o, actor) {
    const adviser = await resolve(db, 'advisers', required(o, 'adviser'));
    const c = await insert(db, 'clients', {
      reference: required(o, 'reference'), jurisdiction: oneOf(required(o, 'jurisdiction'), ['AU', 'NZ'], 'jurisdiction'),
      adviser_id: adviser.id, ...clientFields({ ...o, name: required(o, 'name') }),
      last_review_on: safeDate(o['last-review'], '--last-review'), client_since: safeDate(o.since, '--since') ?? today(),
    });
    await note(db, c.id, actor, 'note', 'Client added');
    return c;
  },

  async 'update-client'(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const data = clientFields(o);
    if (o.adviser) data.adviser_id = (await resolve(db, 'advisers', o.adviser)).id;
    if (!Object.keys(data).length) throw Error('Nothing to change: pass at least one field');
    const keys = Object.keys(data);
    const r = (await db.query(`update clients set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`, [...Object.values(data), c.id]))[0];
    await note(db, c.id, actor, 'change', `Updated ${keys.join(', ')}`);
    return r;
  },

  async 'record-review'(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const held = safeDate(o.date, '--date') ?? today();
    if (held > today()) throw Error('A review cannot be recorded before it is held');
    const adviser = o.adviser ? await resolve(db, 'advisers', o.adviser) : { id: c.adviser_id };
    const r = await insert(db, 'reviews', {
      client_id: c.id, held_on: held, adviser_id: adviser.id, kind: oneOf(o.kind ?? 'annual', ['annual', 'interim', 'event'], 'kind'),
      summary: required(o, 'summary'), actions: o.actions ?? '',
    });
    if (r.kind === 'annual') await db.query('update clients set last_review_on = greatest(coalesce(last_review_on, $1::date), $1::date) where id = $2', [held, c.id]);
    await note(db, c.id, actor, 'review', `${r.kind} review held ${held}: ${r.summary}`);
    return r;
  },

  async 'add-arrangement'(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const f = await insert(db, 'fee_arrangements', {
      client_id: c.id, reference: required(o, 'reference'), annual_fee: amount(required(o, 'annual-fee'), '--annual-fee'),
      currency: (o.currency ?? (c.jurisdiction === 'NZ' ? 'NZD' : 'AUD')).toUpperCase(), services: required(o, 'services'),
      accounts: o.accounts ?? '', entered_on: safeDate(o.entered, '--entered') ?? today(),
      next_reference_day: date(required(o, 'reference-day'), '--reference-day', false),
    });
    await note(db, c.id, actor, 'fees', `Ongoing fee arrangement ${f.reference} set up at ${f.currency} ${f.annual_fee} a year`);
    return f;
  },

  async 'record-consent'(db, o, actor) {
    const f = await resolve(db, 'fee_arrangements', required(o, 'arrangement'));
    if (f.status !== 'active') throw Error(`${f.reference} has ended. A client who wants to continue signs a new arrangement.`);
    const c = (await db.query('select * from clients where id = $1', [f.client_id]))[0];
    const signed = safeDate(o.date, '--date') ?? today();
    if (signed > today()) throw Error('A consent cannot be dated in the future');
    const rd = f.next_reference_day;
    const opens = addDays(rd, -60); const closes = addDays(rd, 150);
    if (c.jurisdiction === 'AU' && (signed < opens || signed > closes)) {
      throw Error(`Signed ${signed} is outside the consent window for ${f.reference} (${opens} to ${closes}). ${signed > closes ? 'The arrangement has lapsed: end it and start a new one.' : 'The window is not open yet.'}`);
    }
    const shows = String(required(o, 'shows')).split(',').map((s) => s.trim()).filter(Boolean);
    for (const s of shows) oneOf(s, ['services', 'accounts', 'termination', 'none'], '--shows item');
    let next = o['next-reference-day'] ? date(o['next-reference-day'], '--next-reference-day', false) : addDays(rd, 365, true);
    if (next <= rd || next > addDays(rd, 365, true)) throw Error('--next-reference-day must fall after the current reference day and no later than its anniversary');
    const k = await insert(db, 'consents', {
      arrangement_id: f.id, signed_on: signed, for_reference_day: rd, services_listed: shows.includes('services'),
      accounts_listed: shows.includes('accounts'), termination_date_stated: shows.includes('termination'), document: required(o, 'document'), recorded_by: actor,
    });
    await db.query('update fee_arrangements set next_reference_day = $1 where id = $2', [next, f.id]);
    await note(db, c.id, actor, 'fees', `Renewal consent for ${f.reference} signed ${signed}; next reference day ${next}`);
    const missing = ['services', 'accounts', 'termination'].filter((s) => !shows.includes(s));
    return { ...k, next_reference_day: next, warning: missing.length && c.jurisdiction === 'AU' ? `The form does not show: ${missing.join(', ')}. Check it before relying on it.` : '' };
  },

  async 'end-arrangement'(db, o, actor) {
    const f = await resolve(db, 'fee_arrangements', required(o, 'arrangement'));
    if (f.status === 'ended') throw Error(`${f.reference} already ended on ${f.ended_on}`);
    const on = safeDate(o.date, '--date') ?? today();
    const r = (await db.query("update fee_arrangements set status = 'ended', ended_on = $1, end_reason = $2 where id = $3 returning *", [on, required(o, 'reason'), f.id]))[0];
    await note(db, f.client_id, actor, 'fees', `Ongoing fee arrangement ${f.reference} ended ${on}: ${r.end_reason}. Tell the platform to stop deducting the fee.`);
    return r;
  },

  async 'add-advice'(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const v = await insert(db, 'advice_files', {
      client_id: c.id, reference: required(o, 'reference'), topic: required(o, 'topic'),
      document_kind: oneOf(required(o, 'kind'), ['SOA', 'ROA', 'advice record'], 'kind'), prepared_by: o['prepared-by'] ?? actor,
      scope: o.scope ?? '', advice_fee: o.fee ? amount(o.fee, '--fee') : '0',
    });
    await note(db, c.id, actor, 'advice', `Advice file ${v.reference} opened: ${v.topic}`);
    return v;
  },

  async 'move-advice'(db, o, actor) {
    const v = await resolve(db, 'advice_files', required(o, 'advice'));
    const c = (await db.query('select * from clients where id = $1', [v.client_id]))[0];
    const stage = oneOf(required(o, 'stage'), STAGES, 'stage');
    const on = safeDate(o.date, '--date') ?? today();
    const next = { ...v, scope: o.scope ?? v.scope, reasons: o.reasons ?? v.reasons, disclosure_given_on: safeDate(o.disclosure, '--disclosure') ?? v.disclosure_given_on };
    if (stage === 'presented' || stage === 'implemented') {
      const gaps = [];
      if (!String(next.scope).trim()) gaps.push('--scope (what the advice covers and what it leaves out)');
      if (!String(next.reasons).trim()) gaps.push('--reasons (why it suits this client)');
      if (c.jurisdiction === 'NZ' && !next.disclosure_given_on) gaps.push('--disclosure (the date the disclosure was given)');
      if (gaps.length) throw Error(`${v.reference} cannot be ${stage} without ${gaps.join(', ')}. See docs/compliance.md.`);
    }
    if (stage === 'implemented' && !v.presented_on) throw Error(`${v.reference} has not been presented yet`);
    const r = (await db.query(`update advice_files set stage = $1, stage_since = $2, scope = $3, reasons = $4, disclosure_given_on = $5,
      presented_on = case when $1 = 'presented' then $2::date else presented_on end,
      implemented_on = case when $1 = 'implemented' then $2::date else implemented_on end where id = $6 returning *`,
    [stage, on, next.scope, next.reasons, next.disclosure_given_on, v.id]))[0];
    await note(db, c.id, actor, 'advice', `${v.reference} moved from ${v.stage} to ${stage}`);
    return r;
  },

  async log(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    await note(db, c.id, actor, oneOf(o.kind ?? 'note', ['note', 'call', 'email', 'meeting'], 'kind'), required(o, 'note'));
    return { client: c.reference, recorded: true };
  },

  async 'add-complaint'(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const k = await insert(db, 'complaints', { client_id: c.id, reference: required(o, 'reference'), received_on: safeDate(o.received, '--received') ?? today(), summary: required(o, 'summary') });
    await note(db, c.id, actor, 'complaint', `Complaint ${k.reference} received ${k.received_on}: ${k.summary}`);
    return k;
  },

  async 'acknowledge-complaint'(db, o, actor) {
    const k = await resolve(db, 'complaints', required(o, 'complaint'));
    if (k.acknowledged_on) throw Error(`${k.reference} was acknowledged on ${k.acknowledged_on}`);
    const on = safeDate(o.date, '--date') ?? today();
    if (on < k.received_on) throw Error('Acknowledged before it was received');
    const r = (await db.query('update complaints set acknowledged_on = $1 where id = $2 returning *', [on, k.id]))[0];
    await note(db, k.client_id, actor, 'complaint', `Complaint ${k.reference} acknowledged ${on}`);
    return r;
  },

  async 'respond-complaint'(db, o, actor) {
    const k = await resolve(db, 'complaints', required(o, 'complaint'));
    if (k.responded_on) throw Error(`${k.reference} was responded to on ${k.responded_on}`);
    const on = safeDate(o.date, '--date') ?? today();
    if (on < k.received_on) throw Error('Responded before it was received');
    const r = (await db.query('update complaints set responded_on = $1, outcome = $2, acknowledged_on = coalesce(acknowledged_on, $1) where id = $3 returning *', [on, required(o, 'outcome'), k.id]))[0];
    await note(db, k.client_id, actor, 'complaint', `Complaint ${k.reference} responded ${on}: ${r.outcome}`);
    return r;
  },

  async 'add-cpd'(db, o) {
    const a = await resolve(db, 'advisers', required(o, 'adviser'));
    const hours = Number(amount(required(o, 'hours'), '--hours'));
    if (hours <= 0 || hours > 40) throw Error('--hours must be more than 0 and at most 40');
    return insert(db, 'cpd', {
      adviser_id: a.id, completed_on: safeDate(o.date, '--date') ?? today(), hours, category: oneOf(required(o, 'category'), CPD_CATEGORIES, 'category'),
      qualifying: !o['non-qualifying'], activity: required(o, 'activity'),
    });
  },
};

function addDays(iso, n, year = false) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (year) d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- drafts (never sent)

async function draftReviewInvite(db, o) {
  const c = await resolve(db, 'clients', required(o, 'client'));
  const a = c.adviser_id ? (await db.query('select * from advisers where id = $1', [c.adviser_id]))[0] : { name: '[Adviser]' };
  const fees = await db.query("select reference, services from fee_arrangements where client_id = $1 and status = 'active'", [c.id]);
  const last = (await db.query('select * from reviews where client_id = $1 order by held_on desc limit 1', [c.id]))[0];
  const open = await db.query("select topic, stage from advice_files where client_id = $1 and stage not in ('implemented','declined')", [c.id]);
  const text = `# DRAFT: review invitation for ${c.name} (${c.reference})

Draft only. Nothing has been sent. Read the client file before it goes.

To: ${c.email || '[email not on file]'}
Subject: Time for your ${last ? 'annual' : 'first'} review

Hi ${c.name.split(' and ')[0].split(' ')[0]},

It is time for your ${last ? 'annual review' : 'first review'}${last ? `. We last sat down on ${last.held_on}, when we ${last.summary.charAt(0).toLowerCase()}${last.summary.slice(1)}` : ''}.
${last?.actions ? `\nFrom that meeting we agreed: ${last.actions}.\n` : ''}${fees.length ? `\nAs part of your ongoing service you are entitled to: ${fees.map((f) => f.services).join('; ')}. The review is how we deliver it.\n` : ''}${open.length ? `\nWe will also go through: ${open.map((v) => `${v.topic} (${v.stage})`).join(', ')}.\n` : ''}
Before we meet, let us know if anything has changed: work, health, family, property, or plans for the next few years.

Reply with two times that suit you over the next three weeks and we will lock one in.

${a.name}
`;
  return { file: writeDraft(`review-invite-${c.reference}`, text), client: c.reference };
}

async function draftConsent(db, o) {
  const f = await resolve(db, 'fee_arrangements', required(o, 'arrangement'));
  const c = (await db.query('select * from clients where id = $1', [f.client_id]))[0];
  const a = c.adviser_id ? (await db.query('select * from advisers where id = $1', [c.adviser_id]))[0] : { name: '[Adviser]', registration: '' };
  const terminates = addDays(f.next_reference_day, 150);
  const au = c.jurisdiction === 'AU';
  const text = `# DRAFT: ${au ? 'ongoing fee arrangement renewal consent' : 'ongoing service agreement renewal'} for ${c.name} (${f.reference})

Draft only. Nothing has been sent. ${au ? 'Check it against your licensee\'s consent template before it goes. ASIC INFO 286 sets out what the consent must contain.' : 'Check it against your practice\'s service agreement before it goes.'}

Client: ${c.name}
Adviser: ${a.name}${a.registration ? ` (${a.registration})` : ''}
Arrangement: ${f.reference}

## The services you are entitled to over the next twelve months

${f.services.split(/,\s*/).map((s) => `- ${s}`).join('\n')}

## The fee

${f.currency} ${f.annual_fee} for the twelve months, ${f.accounts ? `deducted from: ${f.accounts}` : 'invoiced to you'}.

## Dates

- Reference day: ${f.next_reference_day}
- ${au ? `If this consent is not signed by ${terminates}, the arrangement ends on that date and no further fees will be charged.` : `If you do not renew by ${terminates}, we will stop the service and the fee.`}

You can end the arrangement at any time by telling us in writing.

Signed: ____________________   Date: __________
`;
  return { file: writeDraft(`consent-${f.reference}`, text), arrangement: f.reference, terminates_on: terminates };
}

// ---------------------------------------------------------------- import from Xplan

// Xplan's client list exports to CSV with whatever columns the site has configured on the client
// search screen. These are the usual headings; --map=columns.json overrides any of them.
export const XPLAN_FIELDS = {
  source_id: ['Client ID', 'Entity ID', 'Xplan ID', 'ID'],
  name: ['Client Name', 'Name', 'Full Name', 'Entity Name'],
  adviser: ['Adviser', 'Primary Adviser', 'Adviser Name'],
  status: ['Client Status', 'Status'],
  package: ['Service Package', 'Service Level', 'Client Category', 'Category'],
  last_review: ['Last Review Date', 'Last Review'],
  since: ['Client Since', 'Start Date', 'Date Joined'],
  email: ['Email', 'Email Address', 'Preferred Email'],
  phone: ['Mobile', 'Mobile Phone', 'Phone', 'Preferred Phone'],
};
const STATUS_MAP = { client: 'active', active: 'active', current: 'active', prospect: 'prospect', lead: 'prospect', inactive: 'ceased', ceased: 'ceased', lost: 'ceased', former: 'ceased', deceased: 'ceased' };

async function importXplan(db, o, actor) {
  const rows = parseCsv(fs.readFileSync(required(o, 'file'), 'utf8'));
  if (!rows.length) throw Error('The CSV has no rows');
  let map = {};
  if (o.map) {
    map = JSON.parse(fs.readFileSync(required(o, 'map'), 'utf8'));
    for (const [k, v] of Object.entries(map)) if (!(k in XPLAN_FIELDS) || typeof v !== 'string' || !v.trim()) throw Error(`Unknown or empty map field: ${k}`);
    for (const col of Object.values(map)) if (!Object.keys(rows[0]).some((h) => h.toLowerCase() === col.toLowerCase())) throw Error(`Mapped column not in the file: ${col}`);
  }
  const jurisdiction = oneOf(o.jurisdiction ?? 'AU', ['AU', 'NZ'], 'jurisdiction');
  const seen = new Set();
  const input = rows.map((row, i) => {
    const read = (k) => String(map[k] ? pick(row, map[k]) : pick(row, ...XPLAN_FIELDS[k])).trim();
    const line = `Row ${i + 2}`;
    const source_id = read('source_id'); const name = read('name');
    if (!source_id || !name) throw Error(`${line}: a client id and a name are required. Map your headings with --map.`);
    if (seen.has(source_id)) throw Error(`${line}: client id ${source_id} appears twice`);
    seen.add(source_id);
    const rawStatus = read('status').toLowerCase() || 'client';
    const status = STATUS_MAP[rawStatus];
    if (!status) throw Error(`${line}: status "${read('status')}" is not one this import knows. Map it in a copy of the file first.`);
    const sorted = Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
    const data = {
      source_id, reference: `X-${source_id}`, name, status, jurisdiction, service_package: read('package'),
      last_review_on: safeDate(read('last_review'), `${line} last review`), client_since: safeDate(read('since'), `${line} client since`),
      email: read('email'), phone: read('phone'), adviser: read('adviser'), source_row: row,
    };
    data.source_hash = createHash('sha256').update(JSON.stringify({ ...data, source_row: sorted })).digest('hex');
    return data;
  });
  return transaction(db, async () => {
    let added = 0; let unchanged = 0; const advisersAdded = [];
    for (const { adviser, ...data } of input) {
      const old = (await db.query('select source_hash from clients where source_id = $1', [data.source_id]))[0];
      if (old) {
        if (old.source_hash !== data.source_hash) throw Error(`Client ${data.source_id} changed in Xplan since the last import. Reconcile it by hand before importing again.`);
        unchanged++; continue;
      }
      let adviserId = null;
      if (adviser) {
        const hit = await db.query('select id from advisers where lower(name) = lower($1) or lower(code) = lower($1)', [adviser]);
        if (hit.length) adviserId = hit[0].id;
        else {
          const code = adviser.split(/\s+/).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(2, 'X');
          if ((await db.query('select 1 from advisers where code = $1', [code])).length) throw Error(`Adviser "${adviser}" is new but the code ${code} is taken. Add the adviser first with add-adviser.`);
          adviserId = (await insert(db, 'advisers', { code, name: adviser, jurisdiction })).id;
          advisersAdded.push(`${code} ${adviser}`);
        }
      }
      const c = await insert(db, 'clients', { ...data, adviser_id: adviserId });
      await note(db, c.id, actor, 'import', 'Imported from the Xplan client list. Original columns kept on the record.');
      added++;
    }
    return { added, unchanged, advisers_added: advisersAdded.join(', ') || 'none', dry_run: Boolean(o['dry-run']),
      next: 'Fee arrangements, advice files and file notes are not in the client list export. See docs/replace-xplan.md.' };
  }, Boolean(o['dry-run']));
}

// ---------------------------------------------------------------- dispatch

const OPTIONS = {
  advisers: [], clients: ['adviser', 'status'], client: ['client'], 'reviews-due': ['days'], 'consents-due': ['days'], 'fee-book': [],
  pipeline: ['stuck'], complaints: ['open'], cpd: [], attention: [], compliance: [], 'weekly-review': [], 'file-notes': ['client', 'limit'],
  'add-adviser': ['code', 'name', 'jurisdiction', 'role', 'registration', 'cpd-year-starts'],
  'add-client': ['reference', 'name', 'adviser', 'jurisdiction', 'kind', 'status', 'package', 'review-months', 'last-review', 'since', 'email', 'phone'],
  'update-client': ['client', 'name', 'adviser', 'kind', 'status', 'package', 'review-months', 'email', 'phone'],
  'record-review': ['client', 'summary', 'date', 'kind', 'actions', 'adviser'],
  'add-arrangement': ['client', 'reference', 'annual-fee', 'services', 'reference-day', 'currency', 'accounts', 'entered'],
  'record-consent': ['arrangement', 'document', 'shows', 'date', 'next-reference-day'],
  'end-arrangement': ['arrangement', 'reason', 'date'],
  'add-advice': ['client', 'reference', 'topic', 'kind', 'prepared-by', 'scope', 'fee'],
  'move-advice': ['advice', 'stage', 'scope', 'reasons', 'disclosure', 'date'],
  log: ['client', 'note', 'kind'], 'add-complaint': ['client', 'reference', 'summary', 'received'],
  'acknowledge-complaint': ['complaint', 'date'], 'respond-complaint': ['complaint', 'outcome', 'date'],
  'add-cpd': ['adviser', 'hours', 'category', 'activity', 'date', 'non-qualifying'],
  'draft-review-invite': ['client'], 'draft-consent': ['arrangement'], import: ['file', 'map', 'dry-run', 'jurisdiction'], export: [],
};
const FLAGS = ['json', 'dry-run', 'open', 'non-qualifying'];

export async function run(db, argv) {
  const { o, p } = args(argv);
  const command = p[0] || 'help';
  if (!(command in commands)) throw Error(`Unknown command "${command}". Run help.`);
  if (command === 'help') return Object.entries(commands).map(([name, usage]) => ({ command: name, usage }));
  const allowed = [...OPTIONS[command], 'json', ...(command in WRITES || command === 'import' ? ['actor'] : [])];
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw Error(`Unknown option --${k} for ${command}`);
  for (const k of FLAGS) if (Object.hasOwn(o, k) && o[k] !== true) throw Error(`--${k} takes no value`);
  if (p.length > (command === 'import' ? 2 : 1)) throw Error('Unexpected extra argument');

  if (command in READS) return READS[command](db, o);
  if (command === 'draft-review-invite') return draftReviewInvite(db, o);
  if (command === 'draft-consent') return draftConsent(db, o);
  if (command === 'export') {
    const backup = { format: 'advice-practice-for-claude-code/v1', exported_at: new Date().toISOString(), records: {} };
    for (const t of TABLES) backup.records[t] = await db.query(`select * from ${t} order by id`);
    const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'exports');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `advice-practice-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2) + '\n', { flag: 'wx' });
    return { file, clients: backup.records.clients.length, file_notes: backup.records.file_notes.length };
  }
  const actor = required(o, 'actor');
  if (command === 'import') {
    if (p[1] !== 'xplan') throw Error('Supported import: xplan');
    return importXplan(db, o, actor);
  }
  return transaction(db, () => WRITES[command](db, o, actor));
}

// ---------------------------------------------------------------- output

const HIDE = new Set(['id', 'client_id', 'adviser_id', 'arrangement_id', 'source_row', 'source_hash', 'created_at', 'updated_at']);
export function human(result) {
  if (Array.isArray(result)) {
    if (!result.length) return '  (none)';
    const cols = Object.keys(result[0]).filter((k) => !HIDE.has(k));
    return table(result, cols.map((key) => ({ key, label: key, width: key === 'finding' || key === 'why' || key === 'note' ? 90 : 60, format: (v) => (v && typeof v === 'object' ? JSON.stringify(v) : v === true ? 'yes' : v === false ? 'no' : String(v ?? '')) })));
  }
  if (result && typeof result === 'object') {
    return Object.entries(result).map(([k, v]) => (v && typeof v === 'object' ? `${k}\n${'='.repeat(k.length)}\n${human(Array.isArray(v) ? v : [v])}` : `${k}: ${v ?? ''}`)).join('\n\n');
  }
  return String(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
