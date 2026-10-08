---
description: Record a review that has been held, and roll the client's next review date on.
---

Run `npm run advice -- record-review --client="<client>" --summary="<what was covered>" --actions="<what happens next>" --actor="<operator>"` (add `--date` if it was not today, `--kind=interim|event` if it was not the annual review).

Recording an annual review moves the client's last review date. Then offer to render the review summary for the client: `npm run docs -- review-summary`.
