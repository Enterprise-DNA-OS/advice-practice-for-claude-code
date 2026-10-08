# Advice Practice for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs attention, what is late | `/attention` |
| The Monday review, a note for the principal | `/weekly-review` |
| Fee consents, renewals, what lapses | `/consents-due` |
| Fee revenue, fees at risk | `/fee-book` |
| Who is due a review | `/reviews-due` |
| SOAs in progress, what is stuck | `/pipeline` |
| Open an advice file, move it a stage | `/advice` |
| Complaints | `/complaints` |
| CPD hours | `/cpd` |
| Are we compliant, what breaches a rule | `/compliance` |
| A list of clients | `/clients` |
| Everything on one client | `/client` |
| A new client or prospect | `/add-client` |
| A review was held | `/record-review` |
| A consent came back signed | `/record-consent` |
| Note a call, email or meeting | `/log` |
| Invite a client to a review | `/draft-review-invite` |
| The renewal consent form | `/draft-consent` |
| Bring data across from Xplan | `/import` |
| A backup | `/export` |
| Change a field, a stage or a rule | `/customise` |
| A new dashboard | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run <cli> -- --help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never back-date a consent, a review or a disclosure. Record the real date and let the compliance check say what it says.
- Never write the reasons for advice from nothing. They come from the adviser, or from the file notes and fact find when the adviser asks, and are shown before saving.
- Client records are personal information. Exports stay in `exports/` (ignored by git) and drafts in `drafts/`.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Xplan.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/xplan
