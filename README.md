<h1 align="center">Advice Practice for Claude Code</h1>

<p align="center">
  <strong>The open-source financial advice practice system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Xplan data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=xplan">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/xplan?utm_source=github&utm_medium=readme&utm_campaign=xplan">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-xplan">Instead of Xplan</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Advice Practice for Claude Code does the job you pay Xplan for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Xplan dashboard cannot.

Iress prices Xplan privately: per user, per module (client file, research, risk, modelling, hosting), on an annual agreement that renews unless you give notice. There is no public price list, so check your own invoice. Most practices pay for every adviser and paraplanner seat, every year, whether they use the modules or not.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=xplan).

It covers the part of Xplan an advice practice runs its week on: client households and their adviser, the review cycle, ongoing fee arrangements and their consent windows, advice files from fact find to implementation, complaints with their clocks, CPD, and file notes. It is built for Australian and New Zealand practices of one to twenty advisers, with the AU ongoing fee consent rules (as changed in January 2025), ASIC RG 271 complaint timeframes, and the NZ disclosure and advice record rules checked by one command.

### Ten questions Xplan's reports do not answer in one go

1. Which ongoing fee arrangements have lapsed because no consent came back inside the 150 days, and how much fee is that by adviser? (`consents-due`, `fee-book`)
2. Which windows close in the next 45 days with no signed consent? (`consents-due`)
3. Which clients pay an ongoing fee and are more than a month past their review? (`reviews-due`, `compliance`)
4. Which signed consents are missing the services, the accounts or the termination date? (`compliance`)
5. Which statements of advice have sat in one stage for three weeks, and who has them? (`pipeline --stuck=21`)
6. Which advice was presented without its scope or its reasons on file? (`compliance`)
7. Which complaints are past, or close to, their acknowledgement or response deadline? (`complaints --open`)
8. Which advisers are short of 40 CPD hours, or of a category minimum, with under 90 days left? (`cpd`)
9. Which fee-paying clients have had no file note in 90 days? (`attention`)
10. How much ongoing fee sits on clients whose review is overdue, per adviser and currency? (`fee-book`)

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/advice-practice-for-claude-code.git
cd advice-practice-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. Next try `/consents-due`, then `/weekly-review`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything late, lapsing, stuck or quiet, in one list |
| `/weekly-review` | The Monday note: money at risk, reviews owed, pipeline, complaints, compliance |
| `/consents-due` | Ongoing fee arrangements lapsed, closing or about to open their consent window |
| `/fee-book` | Ongoing fee revenue by adviser and currency, and the share at risk |
| `/reviews-due` | Reviews due or overdue, flagging clients who pay an ongoing fee |
| `/pipeline` | Statements of advice and advice records in progress, stuck ones first |
| `/complaints` | Complaints with their acknowledgement and response clocks |
| `/cpd` | CPD hours this year by adviser and category |
| `/compliance` | Every rule in `docs/compliance.md` checked, with its source |
| `/clients` | Client households by adviser or status |
| `/client` | One client's whole file |
| `/add-client` | Add a client or prospect |
| `/record-review` | Record a review and roll the next one on |
| `/record-consent` | Record a signed renewal consent and roll the reference day on |
| `/advice` | Open an advice file or move it a stage (with the presentation gate) |
| `/log` | A file note: call, email, meeting or note |
| `/draft-review-invite` | Draft a review invitation to `drafts/`. Never sends |
| `/draft-consent` | Draft a renewal consent to `drafts/`. Never sends |
| `/import` | Bring clients across from an Xplan client list export |
| `/export` | Every record to a JSON backup |
| `/customise` | Add a field, rename a stage, change a rule, in plain words |
| `/new-view` | Add an HTML dashboard |

Behind them is one CLI, `npm run advice -- help`, with 32 commands and `--json` on every one. `npm run view` renders the week, fee book and pipeline as branded HTML; `npm run docs` renders renewal consent forms, client review summaries and the complaints register.

### Your first hour: ten things to ask for

1. "What needs attention this week?"
2. "Which consents lapse this month and how much fee is that?"
3. "Draft the consent for every arrangement whose window opens in the next 30 days."
4. "Who pays us an ongoing fee and has not had a review this year?"
5. "Draft review invitations for Sarah's five most overdue clients."
6. "What is stuck in compliance check?"
7. "Write the Monday note for the principal."
8. "Put our business name and colours on the consent form." (`brand.json`)
9. "Add a field for the platform each client is on, and show it in the fee book." (`/customise`)
10. "Bring across our Xplan client list." (`/import`)

## Instead of Xplan

Export the client list from Xplan's client search screen to CSV, then `npm run advice -- import xplan --file=client-list.csv --dry-run --actor="Your Name"`. Fee arrangements, advice files in progress and file notes come across separately. The whole path, the column map and what does not carry over: [docs/replace-xplan.md](docs/replace-xplan.md). The rules the compliance check enforces, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
advice-practice-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Advice Practice for Claude Code for your business, migrates your Xplan data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=xplan)
- Read more: [enterprisedna.co/omni/instead-of/xplan](https://enterprisedna.co/omni/instead-of/xplan?utm_source=github&utm_medium=readme&utm_campaign=xplan)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
