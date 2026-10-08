---
description: List client households, by adviser or status.
---

Run `npm run advice -- clients` (add `--adviser=<code or name>` or `--status=active|prospect|ceased` if the operator narrowed it).

Present as a table: reference, name, adviser, package, last review, number of fee arrangements. End with one line: how many active clients, how many prospects. If a name the operator gave matches nobody, say so and list near matches from the full list.
