---
description: CPD hours this CPD year by adviser and category, against the AU minimums.
---

Run `npm run advice -- cpd`.

For AU advisers show total hours against 40 and the category minimums (technical 5, client care and practice 5, regulatory compliance and consumer protection 5, professionalism and ethics 9), with days left in their CPD year. Name the shortfall in plain words. NZ advisers have no set hours: show what is recorded and flag nothing in the last twelve months.

To record CPD: `npm run advice -- add-cpd --adviser=<code> --hours=<n> --category="<category>" --activity="<what>" --actor="<operator>"` (add `--non-qualifying` when the licensee has not approved it).
