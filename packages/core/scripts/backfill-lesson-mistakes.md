# Recover lesson mistake attribution

`backfill:lesson-mistakes` repairs missing skill pointers in question screens, attempts and notebook entries. It uses existing lesson links for an untagged screen, then surviving step, item and attempt links for learner rows. It never creates skills or mistakes, infers answers from text, overwrites a non-null skill, changes snapshots or fixed/open status, or replays historical mastery and analytics. Retired screens are included while they still exist. Chapter challenge cases deliberately have no single skill and do not enter the notebook.

The command defaults to a dry run. Its JSON summary gives `recoverable`, `repaired` and `unresolved` counts for each table. A dry run writes nothing and includes the downstream repairs its proposed screen and attempt attribution makes possible. An apply run changes only pointers that are still null, in one transaction. Repeating it is safe; recovered rows are absent from the next run. Rows without surviving attribution links remain unchanged and are counted as unresolved.

## Local development

From the repository root, using the local development environment:

```bash
mise x -- pnpm --filter @zoonk/core exec tsx --env-file=../db/.env --conditions=react-server scripts/backfill-lesson-mistakes.ts --dry-run
mise x -- pnpm --filter @zoonk/core exec tsx --env-file=../db/.env --conditions=react-server scripts/backfill-lesson-mistakes.ts --apply
```

Use the worktree's development override as well when its URL is in a separate environment file. Never point this command at a test database to verify the product; the database tests use their own disposable copy.

## Production

Deploy the persistence repair first. In a secure operator shell with `DATABASE_URL` set to the intended production database, run:

```bash
pnpm --filter @zoonk/core backfill:lesson-mistakes --dry-run
pnpm --filter @zoonk/core backfill:lesson-mistakes --apply --production
pnpm --filter @zoonk/core backfill:lesson-mistakes --dry-run
```

Review and retain the first summary before applying. `--production` is the explicit operator opt-in for writes outside the local development database. Keep credentials in the environment. The final dry run should show no remaining recoverable rows, unless new data arrived meanwhile. The transaction has a two-minute timeout; an error rolls it back and exits nonzero. A fresh notebook visit reads the repaired attribution; already-open prefetched views may need a reload. No schema migration or model call is required.

This cannot restore deleted learner rows, reconstruct historical review state, or safely repair old non-null skill guesses. Missing numeric items from historical skill-less calculation screens are also outside attribution recovery: new saves now create them after repairing the screen skill.
