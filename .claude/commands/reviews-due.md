---
description: Who is due or overdue a review, worst first, flagging clients paying an ongoing fee.
---

Run `npm run advice -- reviews-due --days=30` (use the operator's window if they gave one).

Present grouped by adviser, overdue first. Flag every row where `fee` is yes and the review is overdue: that client is paying for a service they have not had (see POLICY-SERVICE in `docs/compliance.md`). Offer `/draft-review-invite` for the top five.
