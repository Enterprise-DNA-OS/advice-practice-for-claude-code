# Why there is no front end

Xplan is several products in one subscription: a client database, a workflow engine, a modelling
suite, research data and a document merge. The part an advice practice runs its week on is the
first two. Clients, who their adviser is, when their review is due, which fee arrangements need a
consent, which statements of advice are stuck, which complaints are on the clock. That is a handful
of tables and a few questions asked every Monday.

The screens were there because the database was hard to talk to. It is not any more. Open this
folder in Claude Code and ask "which consents close this month, and how much fee is that?" It runs
the query and answers. Ask a question no Xplan report was built for, and it still answers.

## What you gain

- **Answers the reports do not give.** Fee at risk by adviser, clients paying for a review they have
  not had, advice files stuck in compliance check for three weeks, all from one question.
- **Rules you can read.** Every compliance check is written down in `docs/compliance.md` with its
  source, and is one query you can change.
- **No seats and no modules.** A paraplanner, a client services officer and the principal can all
  ask. Nothing is priced per user.
- **Your records in your own Postgres.** Back them up, connect them to anything, leave any time.

## What a screen gives that this does not

- **Modelling.** Cash-flow projections, Centrelink, tax and insurance needs calculators are not here.
- **Research and platform data feeds.** Product research, fund data and nightly platform holdings
  are not here.
- **Document merge.** Your statement of advice template stays where it is. This tracks the file and
  holds the scope and reasons; it does not write the document.
- **A client portal and a phone app.** It runs where Claude Code runs.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version.

Every one of those can be connected or built for a practice that needs it: a platform data feed, a
web front end for client services, a portal. That is the customised version.

## Who this fits

Practices whose Xplan bill is mostly paying for the client file and the review cycle, who already
model in a separate tool, and who would rather ask than click. If your paraplanners live inside
Xplan's modelling all day, keep it for that and move the rest.

Installed and run for you: https://enterprisedna.co/omni/instead-of/xplan
