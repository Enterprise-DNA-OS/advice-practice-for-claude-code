---
description: Add a new client household or prospect.
---

Run `npm run advice -- add-client --reference=<C-xxxx> --name="<name>" --adviser=<code> --jurisdiction=AU|NZ --actor="<operator>"`, with `--kind`, `--status=prospect`, `--package`, `--email`, `--phone` as given.

Check `clients` first so you do not create a duplicate. If the operator gave no reference, use the next free C-number.
