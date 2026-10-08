---
description: Record a signed ongoing fee renewal consent and roll the reference day on a year.
---

Run `npm run advice -- record-consent --arrangement=<ref> --document="<where the signed form is kept>" --shows=services,accounts,termination --actor="<operator>"`.

Before you run it, ask the operator what the signed form shows. `--shows` lists only what is actually on it: the services for the period, the accounts fees come from, the date the arrangement ends if not signed. Leaving one out records the gap and the compliance check flags it (AU-OFA-CONTENT).

The CLI refuses a consent outside the window (60 days before to 150 days after the reference day) for AU clients. A lapsed arrangement is ended with `end-arrangement`, and the client signs a new one.
