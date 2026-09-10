import { postgresEnvironment, run, sqlLiteral } from "./postgres.mts";

/** Statistics only establish inactivity after two unchanged observations. Resets, restarts, reads, and writes all extend retention. */
export function pruneDatabases({
  source,
  worktree,
}: {
  source: URL;
  worktree: string;
}): Promise<string> {
  const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;

  const script = String.raw`
SELECT pg_try_advisory_lock(hashtext('zoonk-worktree-cleanup')) AS cleanup_lock \gset
\if :cleanup_lock
CREATE TEMP VIEW zoonk_worktree_activity AS
WITH databases AS (
  SELECT d.datname, s.numbackends,
    CASE WHEN shobj_description(d.oid, 'pg_database') IS JSON OBJECT
      THEN shobj_description(d.oid, 'pg_database')::jsonb ELSE '{}'::jsonb END AS metadata,
    md5(concat_ws(':', s.xact_commit, s.xact_rollback, s.tup_inserted, s.tup_updated,
      s.tup_deleted, s.sessions, s.stats_reset, pg_postmaster_start_time())) AS fingerprint
  FROM pg_database d JOIN pg_stat_database s ON s.datid = d.oid
  WHERE d.datname ~ '^zoonk_wt_[a-f0-9]{12}_(dev|test|e2e)$'
)
SELECT *, CASE WHEN metadata->>'observedAt' ~ '^[0-9]{13}$'
  THEN (metadata->>'observedAt')::bigint END AS observed_at
FROM databases WHERE metadata->>'owner' = 'zoonk-worktree-v1'
  AND metadata->>'source' = ${sqlLiteral(source.pathname)};

SELECT format('DROP DATABASE %I', datname)
FROM zoonk_worktree_activity
WHERE numbackends = 0 AND metadata->>'worktree' <> ${sqlLiteral(worktree)}
  AND metadata->>'fingerprint' = fingerprint
  AND observed_at < extract(epoch FROM clock_timestamp()) * 1000 - ${weekMilliseconds}
  AND pg_try_advisory_lock(hashtext('zoonk-worktree:' || (metadata->>'worktree')))
\gexec

SELECT format('COMMENT ON DATABASE %I IS %L', datname,
  (metadata || jsonb_build_object('fingerprint', fingerprint,
    'observedAt', floor(extract(epoch FROM clock_timestamp()) * 1000)))::text)
FROM zoonk_worktree_activity
WHERE metadata->>'fingerprint' IS DISTINCT FROM fingerprint
  OR numbackends > 0 OR metadata->>'worktree' = ${sqlLiteral(worktree)}
\gexec
\endif
`;

  return run({
    args: ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
    command: "psql",
    env: postgresEnvironment(source),
    input: script,
  });
}
