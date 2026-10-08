-- Advice Practice for Claude Code: the records a financial advice practice runs on.
-- Advisers, client households, ongoing fee arrangements and their consents, advice files
-- (statements of advice and advice records) moving through the practice, annual reviews,
-- complaints, CPD and file notes. Plain Postgres; runs on PGlite too.

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table advisers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,4}$'),
  name text not null check (btrim(name) <> ''),
  role text not null default 'adviser' check (role in ('adviser','paraplanner','admin')),
  jurisdiction text not null check (jurisdiction in ('AU','NZ')),
  registration text not null default '',          -- AU: ASIC adviser number. NZ: FSPR number.
  cpd_year_starts date,                           -- first day of the adviser's current CPD year
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  reference text not null check (btrim(reference) <> ''),
  name text not null check (btrim(name) <> ''),
  kind text not null default 'couple' check (kind in ('individual','couple','family','entity')),
  adviser_id uuid references advisers(id),
  jurisdiction text not null check (jurisdiction in ('AU','NZ')),
  status text not null default 'active' check (status in ('prospect','active','ceased')),
  service_package text not null default '',
  review_months int not null default 12 check (review_months between 1 and 36),
  last_review_on date,
  client_since date,
  email text not null default '',
  phone text not null default '',
  source_id text unique,
  source_row jsonb,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_reference_ci on clients(lower(reference));
create index clients_adviser_idx on clients(adviser_id) where status = 'active';

-- An ongoing fee arrangement (AU, Corporations Act Part 7.7A Division 3) or an ongoing
-- service agreement (NZ). next_reference_day drives the consent window: it opens 60 days
-- before and closes 150 days after (s962H, ASIC INFO 286).
create table fee_arrangements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  reference text not null check (btrim(reference) <> ''),
  annual_fee numeric(12,2) not null check (annual_fee >= 0),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  services text not null check (btrim(services) <> ''),
  accounts text not null default '',              -- the accounts fees are deducted from
  entered_on date not null,
  next_reference_day date not null,
  status text not null default 'active' check (status in ('active','ended')),
  ended_on date,
  end_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and ended_on is null) or (status = 'ended' and ended_on is not null and btrim(end_reason) <> ''))
);
create unique index fee_arrangements_reference_ci on fee_arrangements(lower(reference));

create table consents (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references fee_arrangements(id),
  signed_on date not null,
  for_reference_day date not null,               -- the reference day this consent renews
  services_listed boolean not null,
  accounts_listed boolean not null,
  termination_date_stated boolean not null,
  document text not null check (btrim(document) <> ''),
  recorded_by text not null check (btrim(recorded_by) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consents_arrangement_idx on consents(arrangement_id, signed_on desc);

-- One piece of advice moving through the practice: fact find to implementation.
create table advice_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  reference text not null check (btrim(reference) <> ''),
  topic text not null check (btrim(topic) <> ''),
  document_kind text not null check (document_kind in ('SOA','ROA','advice record')),
  stage text not null default 'fact find' check (stage in ('fact find','research','drafting','compliance check','presented','implemented','declined')),
  stage_since date not null default current_date,
  prepared_by text not null default '',
  scope text not null default '',                 -- nature and scope of the advice, and its limits
  reasons text not null default '',               -- why the advice is suitable / in the client's best interests
  disclosure_given_on date,
  presented_on date,
  implemented_on date,
  advice_fee numeric(12,2) not null default 0 check (advice_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index advice_files_reference_ci on advice_files(lower(reference));

create table reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  held_on date not null,
  adviser_id uuid references advisers(id),
  kind text not null default 'annual' check (kind in ('annual','interim','event')),
  summary text not null check (btrim(summary) <> ''),
  actions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_client_idx on reviews(client_id, held_on desc);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  reference text not null check (btrim(reference) <> ''),
  received_on date not null,
  summary text not null check (btrim(summary) <> ''),
  acknowledged_on date,
  responded_on date,
  outcome text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (responded_on is null or btrim(outcome) <> '')
);
create unique index complaints_reference_ci on complaints(lower(reference));

create table cpd (
  id uuid primary key default gen_random_uuid(),
  adviser_id uuid not null references advisers(id),
  completed_on date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 40),
  category text not null check (category in ('technical','client care','regulatory','ethics','tax','general')),
  qualifying boolean not null default true,
  activity text not null check (btrim(activity) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cpd_adviser_idx on cpd(adviser_id, completed_on);

create table file_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  author text not null check (btrim(author) <> ''),
  kind text not null default 'note',
  note text not null check (btrim(note) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index file_notes_client_idx on file_notes(client_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['advisers','clients','fee_arrangements','consents','advice_files','reviews','complaints','cpd','file_notes'] loop
    execute format('create trigger touch_updated_at before update on %I for each row execute function touch_updated_at()', t);
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ views

-- Who is due a review. A client paying an ongoing fee with no review is the fee-for-no-service risk.
create view review_schedule with (security_invoker = true) as
select c.id, c.reference, c.name, a.code as adviser, c.jurisdiction, c.service_package, c.review_months,
  c.last_review_on,
  coalesce((c.last_review_on + make_interval(months => c.review_months))::date, c.client_since, current_date) as due_on,
  current_date - coalesce((c.last_review_on + make_interval(months => c.review_months))::date, c.client_since, current_date) as days_overdue,
  exists (select 1 from fee_arrangements f where f.client_id = c.id and f.status = 'active') as pays_ongoing_fee,
  (select max(n.created_at)::date from file_notes n where n.client_id = c.id) as last_contact
from clients c left join advisers a on a.id = c.adviser_id
where c.status = 'active';

-- Every active fee arrangement and where it sits in its consent window.
create view consent_windows with (security_invoker = true) as
select f.id, f.reference, c.reference as client_ref, c.name as client, a.code as adviser, c.jurisdiction,
  f.annual_fee, f.currency, f.next_reference_day as reference_day,
  (f.next_reference_day - 60) as window_opens,
  (f.next_reference_day + 150) as terminates_on,
  case
    when current_date < f.next_reference_day - 60 then 'not open'
    when current_date <= f.next_reference_day + 150 then 'open'
    else 'lapsed'
  end as window_state,
  (f.next_reference_day + 150) - current_date as days_left,
  (select max(k.signed_on) from consents k where k.arrangement_id = f.id) as last_consent
from fee_arrangements f join clients c on c.id = f.client_id left join advisers a on a.id = c.adviser_id
where f.status = 'active';

-- Advice files not finished, with how long they have sat in their stage.
create view advice_pipeline with (security_invoker = true) as
select v.id, v.reference, c.name as client, a.code as adviser, c.jurisdiction, v.topic, v.document_kind,
  v.stage, v.stage_since, current_date - v.stage_since as days_in_stage, v.prepared_by, v.advice_fee
from advice_files v join clients c on c.id = v.client_id left join advisers a on a.id = c.adviser_id
where v.stage not in ('implemented','declined');

-- CPD hours in each adviser's current CPD year, by the AU category minimums.
create view cpd_progress with (security_invoker = true) as
select a.id, a.code, a.name, a.jurisdiction, a.cpd_year_starts,
  (a.cpd_year_starts + interval '1 year')::date - 1 as cpd_year_ends,
  (a.cpd_year_starts + interval '1 year')::date - 1 - current_date as days_left,
  coalesce(sum(p.hours), 0) as total_hours,
  coalesce(sum(p.hours) filter (where p.qualifying), 0) as qualifying_hours,
  coalesce(sum(p.hours) filter (where p.category = 'technical'), 0) as technical,
  coalesce(sum(p.hours) filter (where p.category = 'client care'), 0) as client_care,
  coalesce(sum(p.hours) filter (where p.category = 'regulatory'), 0) as regulatory,
  coalesce(sum(p.hours) filter (where p.category = 'ethics'), 0) as ethics
from advisers a
left join cpd p on p.adviser_id = a.id and p.completed_on >= a.cpd_year_starts and p.completed_on < (a.cpd_year_starts + interval '1 year')::date
where a.active and a.role = 'adviser' and a.cpd_year_starts is not null
group by a.id;

-- One row per breach. Rule codes are explained, with sources, in docs/compliance.md.
create view compliance_findings with (security_invoker = true) as
select 'AU-OFA-LAPSED'::text as rule, w.reference as record, w.client,
  format('No renewal consent by %s: the arrangement has ended, stop charging the fee', w.terminates_on) as finding, 1 as severity
from consent_windows w where w.jurisdiction = 'AU' and w.window_state = 'lapsed'
union all
select 'AU-OFA-WINDOW', w.reference, w.client,
  format('Consent window closes in %s days (%s)', w.days_left, w.terminates_on), 2
from consent_windows w where w.jurisdiction = 'AU' and w.window_state = 'open' and w.days_left <= 45
  and (w.last_consent is null or w.last_consent < w.window_opens)
union all
select 'AU-OFA-CONTENT', f.reference, c.name,
  format('Consent signed %s is missing: %s', k.signed_on, concat_ws(', ',
    case when not k.services_listed then 'the services for the period' end,
    case when not k.accounts_listed then 'the accounts fees come from' end,
    case when not k.termination_date_stated then 'the termination date' end)), 1
from consents k join fee_arrangements f on f.id = k.arrangement_id join clients c on c.id = f.client_id
where c.jurisdiction = 'AU' and f.status = 'active'
  and k.id = (select k2.id from consents k2 where k2.arrangement_id = f.id order by k2.signed_on desc, k2.created_at desc limit 1)
  and not (k.services_listed and k.accounts_listed and k.termination_date_stated)
union all
select 'POLICY-SERVICE', r.reference, r.name,
  format('Pays an ongoing fee and the review is %s days overdue', r.days_overdue), 2
from review_schedule r where r.pays_ongoing_fee and r.days_overdue > 30
union all
select case c.jurisdiction when 'AU' then 'AU-SOA-BASIS' else 'NZ-ADVICE-RECORD' end, v.reference, c.name,
  format('Advice %s with no %s recorded', v.stage, concat_ws(' and ',
    case when btrim(v.scope) = '' then 'scope and limits' end,
    case when btrim(v.reasons) = '' then 'reasons it suits the client' end)), 1
from advice_files v join clients c on c.id = v.client_id
where v.stage in ('presented','implemented') and (btrim(v.scope) = '' or btrim(v.reasons) = '')
union all
select 'NZ-DISCLOSURE', v.reference, c.name, format('Advice %s with no disclosure date recorded', v.stage), 1
from advice_files v join clients c on c.id = v.client_id
where c.jurisdiction = 'NZ' and v.stage in ('presented','implemented') and v.disclosure_given_on is null
union all
select 'AU-IDR-ACK', k.reference, c.name,
  format('Received %s, not acknowledged by the next business day', k.received_on), 1
from complaints k join clients c on c.id = k.client_id
where c.jurisdiction = 'AU'
  and coalesce(k.acknowledged_on, current_date) > k.received_on + case extract(isodow from k.received_on)::int when 5 then 3 when 6 then 2 else 1 end
union all
select case c.jurisdiction when 'AU' then 'AU-IDR-30' else 'POLICY-NZ-COMPLAINT' end, k.reference, c.name,
  format('Open %s days with no written response', current_date - k.received_on), 1
from complaints k join clients c on c.id = k.client_id
where k.responded_on is null and current_date - k.received_on > case c.jurisdiction when 'AU' then 30 else 20 end
union all
select 'AU-CPD', p.code, p.name,
  format('%s of 40 CPD hours with %s days of the CPD year left%s', p.total_hours, p.days_left,
    case when least(p.technical, p.client_care, p.regulatory) < 5 or p.ethics < 9 then '; a category minimum is short' else '' end), 2
from cpd_progress p where p.jurisdiction = 'AU' and p.days_left <= 90
  and (p.total_hours < 40 or least(p.technical, p.client_care, p.regulatory) < 5 or p.ethics < 9)
union all
select 'POLICY-NZ-CPD', a.code, a.name, 'No CPD recorded in the last twelve months', 2
from advisers a where a.jurisdiction = 'NZ' and a.active and a.role = 'adviser'
  and not exists (select 1 from cpd p where p.adviser_id = a.id and p.completed_on > current_date - 365);

revoke all on review_schedule, consent_windows, advice_pipeline, cpd_progress, compliance_findings from public;
