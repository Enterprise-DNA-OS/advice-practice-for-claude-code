---
description: Complaints with their clocks: acknowledged, days open, days to the deadline.
---

Run `npm run advice -- complaints --open` (drop `--open` for the full register).

AU complaints must be acknowledged by the next business day and answered in writing inside 30 calendar days (ASIC RG 271). NZ uses the practice's own timeframe, 20 days by default. Put anything past or within 5 days of its deadline first.

To record progress: `acknowledge-complaint --complaint=<ref>`, `respond-complaint --complaint=<ref> --outcome="..."`, `add-complaint --client --reference --summary`, each with `--actor`. A written response is drafted to `drafts/` for a person to send.
