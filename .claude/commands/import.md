---
description: Bring clients across from an Xplan client list export.
---

Follow `docs/replace-xplan.md`.

1. Ask for the CSV path. Read the header row and say which columns map to what (`XPLAN_FIELDS` in `scripts/advice.mjs`). If a heading differs, write a `columns.json` map.
2. Dry run first: `npm run advice -- import xplan --file=<csv> --dry-run --actor="<operator>"` (add `--map=columns.json`, `--jurisdiction=NZ` where needed).
3. Show what would be added, including any new advisers. Run it for real only after a yes.
4. Say plainly what did not come across: fee arrangements, advice files, file notes and documents are not in the client list export.
