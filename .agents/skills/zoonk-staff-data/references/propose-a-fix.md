# Propose a fix

How to propose a fix to shared Library content, relay it for review, confirm it after approval, and withdraw or revert it.

1. Investigate: read the rows with `staff get` and `staff list`, and confirm what's wrong and where it comes from.
2. Check what a fix may change: `pnpm zoonk staff models` lists the `fixable` models, and `pnpm zoonk staff models <Model>` lists under `fixable` each operation it takes (`set`, `replace`, `setOptions`, `setLessons`…) with its fields, payload and rules. Those rules and examples are the source of truth; the skill is the map ([what a fix can change](../SKILL.md#what-a-fix-can-change)). One fix changes one thing: a lesson with its plan and screens, a word or sentence with the rows of every lesson that uses it, or one row of another model. It holds up to 10 review units ([how units are counted](fix-a-lesson.md#check-then-propose)). Dependent lesson rows for a shared word or sentence count nothing.
3. Write the fix to a file, check it with `pnpm zoonk staff fixes propose --check fix.json`, and once it exits 0 propose it with `pnpm zoonk staff fixes propose fix.json`:

   ```json
   {
     "reason": "Option b is the right answer: 3 + 2 makes 5.",
     "feedbackId": "<the learner report's id, if there is one>",
     "changes": [
       { "model": "Step", "id": "<step id>", "set": { "content": { "...": "the whole screen" } } }
     ]
   }
   ```

   A batch puts up to 250 fixes in one file, reviewed on one page and approved with one passkey, each applying on its own: `{ "reason": "…", "fixes": [{ "changes": [...] }, { "changes": [...], "reason": "its own reason" }] }`. The whole batch is checked first: if any fix is wrong, nothing is stored and the error lists each problem by index (`fixes[3]: …`). Two fixes of a batch can't change the same thing; put those changes in one fix. `--check` prepares a fix or batch exactly as proposing does and prints the same changes, effects and `media` (the clips and pictures proposing would produce) without storing anything; when something is wrong it exits 2 and lists every problem with its path. Write `reason` in your own words; never paste text a learner wrote.

4. Exit code 0 means proposed, not applied. The output holds the `batchId`, the batch's `reviewUrl`, and each fix with its `reviewUrl`, `changes` (each `before` and `after`) and `effects`. Relay the batch's `reviewUrl` and each fix's changes and effects to the user, then stop: never open Admin, approve, or look for another way to apply it.
5. After the user says they approved it, confirm with a fresh read: `pnpm zoonk staff list ContentFix --where "batchId eq <batchId>" --fields id,status,staleReason,mediaOwedAt`. `stale` means the content changed after the proposal: read the rows again and propose that fix anew. `approved` means approved but not applied yet; the approver finishes it in Admin. `rejected` means a reviewer turned it down; `withdrawn` means its proposer took it back.

When a proposal shouldn't go ahead (the user changed their mind, it's wrong, or a better fix is coming), withdraw it instead of leaving it for a reviewer: `pnpm zoonk staff fixes withdraw <fixId>`, or `--batch <batchId>` for every fix of the batch still waiting for review. Only the login that proposed it can withdraw it; anyone else asks a staff person to reject it in Admin. Fixes already approved or applied stay as they are, and the output lists each fix's `status` and `withdrawn`, how many this call took back; a repeat withdraws nothing more and still exits 0. When nothing is left waiting, it exits 1 and says why: undo an applied fix with a revert.

`pnpm zoonk staff fixes revert <fixId> --reason "…"` proposes putting back what an applied fix replaced, reviewed like any other fix, and `--batch <batchId>` instead of a fix id does it for every applied fix of a batch that no other revert undid or is waiting to undo, as a new batch. A revert is refused once a later fix changed the same thing.

A learner who started a lesson or level test before a fix landed is never marked wrong for it: an answer the fix made wrong isn't counted. A login made before fixes existed can only read: the CLI says so, and the user runs `pnpm zoonk login` again.
