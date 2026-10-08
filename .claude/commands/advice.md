---
description: Open an advice file or move one to its next stage.
---

Opening: `npm run advice -- add-advice --client=<client> --reference=<A-xxxx> --topic="<topic>" --kind=SOA|ROA|"advice record" --actor="<operator>"` with `--scope` and `--fee` if known.

Moving: `npm run advice -- move-advice --advice=<ref> --stage="<stage>" --actor="<operator>"`. Stages: fact find, research, drafting, compliance check, presented, implemented, declined.

The CLI refuses `presented` or `implemented` without the scope and limits and the reasons the advice suits the client, and for NZ clients without the date disclosure was given. Ask the operator for those words. Never write the reasons yourself from nothing: draft them from the file notes and the fact find only if the operator asks, and show them before saving.
