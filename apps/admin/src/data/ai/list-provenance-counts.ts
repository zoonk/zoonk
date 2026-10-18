import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const provenanceTables = [
  "lessons",
  "steps",
  "stepVariants",
  "items",
  "skills",
  "chapters",
  "mediaAssets",
  "answerExplanations",
  "sourceChangeNotices",
  "memoryFacts",
  "planChanges",
] as const;

export type ProvenanceTable = (typeof provenanceTables)[number];

type ProvenanceCountRow = {
  model: string;
  promptVersion: string | null;
  rows: bigint;
  table: ProvenanceTable;
};

/**
 * Rows each model and prompt version wrote per Library table since the start of the period.
 * Provenance is written by Prisma in UTC, so the cutoff is UTC too. Memory facts and plan changes
 * only carry provenance when a model wrote them, so rows without a model are left out.
 */
export const listProvenanceCounts = cacheAdminData(async (periodDays: number) => {
  const rows = await prisma.$queryRaw<ProvenanceCountRow[]>`
    WITH period AS (
      SELECT (NOW() AT TIME ZONE 'UTC') - make_interval(days => ${periodDays}::int) AS since
    ),
    provenance AS (
      SELECT 'lessons' AS "table", model, prompt_version, generated_at FROM library_lessons
      UNION ALL SELECT 'steps', model, prompt_version, generated_at FROM library_steps
      UNION ALL SELECT 'stepVariants', model, prompt_version, generated_at FROM step_variants
      UNION ALL SELECT 'items', model, prompt_version, generated_at FROM items
      UNION ALL SELECT 'skills', model, prompt_version, generated_at FROM skills
      UNION ALL SELECT 'chapters', model, prompt_version, generated_at FROM library_chapters
      UNION ALL SELECT 'mediaAssets', model, prompt_version, generated_at FROM media_assets
      UNION ALL SELECT 'answerExplanations', model, prompt_version, generated_at FROM answer_explanations
      UNION ALL SELECT 'sourceChangeNotices', model, prompt_version, generated_at FROM source_change_notices
      UNION ALL SELECT 'memoryFacts', model, prompt_version, generated_at FROM memory_facts
      UNION ALL SELECT 'planChanges', model, prompt_version, generated_at FROM plan_changes
    )
    SELECT provenance."table", model, prompt_version AS "promptVersion", COUNT(*) AS rows
    FROM provenance, period
    WHERE model IS NOT NULL AND generated_at >= period.since
    GROUP BY provenance."table", model, prompt_version
  `;

  return rows
    .map((row) => ({ ...row, rows: Number(row.rows) }))
    .toSorted(
      (a, b) =>
        provenanceTables.indexOf(a.table) - provenanceTables.indexOf(b.table) || b.rows - a.rows,
    );
});
