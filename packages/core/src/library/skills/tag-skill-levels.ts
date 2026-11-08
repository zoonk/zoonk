import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { classifySkillLevels } from "@zoonk/ai/tasks/language/skill-levels";
import { type CourseLevel, prisma, sql } from "@zoonk/db";
import { BAND_LEVELS } from "../../language/levels/skill-level-rules";

type Analytics = Parameters<typeof classifySkillLevels>[0]["analytics"];

/** Every try claims one, a step's retries included, so two runs' tries end a failure no retry fixes. */
const MAX_TAG_ATTEMPTS = 8;

/** One call places a graph's skills side by side, so it can compare them. */
const SKILLS_PER_CALL = 40;

const OWED_SKILLS_PER_SWEEP = 2000;

/** Only Library skills: a private skill comes from a learner's own material. */
const owesLevel = sql`
  cefr_level IS NULL
  AND level IS NOT NULL
  AND target_language IS NOT NULL
  AND visibility = 'public'
  AND merged_into_id IS NULL
  AND cefr_attempts < ${MAX_TAG_ATTEMPTS}
`;

export type SkillLevelBatch = { skillIds: string[]; targetLanguage: string };

type ClaimedSkill = { description: string; id: string; level: CourseLevel; name: string };

function chunk<T>(items: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / SKILLS_PER_CALL) }, (_, index) =>
    items.slice(index * SKILLS_PER_CALL, (index + 1) * SKILLS_PER_CALL),
  );
}

/** Internal workflow bridge: the skills among `skillIds` still owing a level, one call's worth each. */
export async function findSkillLevelBatches(
  skillIds: readonly string[],
): Promise<SkillLevelBatch[]> {
  const owed = await prisma.$queryRaw<{ id: string; targetLanguage: string }[]>`
    SELECT id, target_language AS "targetLanguage"
    FROM skills
    WHERE id = ANY(${[...skillIds]}::uuid[]) AND ${owesLevel}
  `;

  const languageOf = new Map(owed.map((skill) => [skill.id, skill.targetLanguage]));
  const inOrder = skillIds.filter((id) => languageOf.has(id));

  return [...Map.groupBy(inOrder, (id) => languageOf.get(id) ?? "")].flatMap(
    ([targetLanguage, ids]) => chunk(ids).map((batch) => ({ skillIds: batch, targetLanguage })),
  );
}

/**
 * Skips skills another run is tagging; the run holding one claims it again on a retry, and a claim
 * older than any call belongs to a run that stopped. Raw, so a try leaves `updatedAt` alone until a
 * level is written. Keeps the batch's order.
 */
async function claimAttempt({
  batch: { skillIds, targetLanguage },
  workflowRunId,
}: {
  batch: SkillLevelBatch;
  workflowRunId: string;
}): Promise<ClaimedSkill[]> {
  const now = new Date();

  const claimed = await prisma.$queryRaw<ClaimedSkill[]>`
    UPDATE skills
    SET
      cefr_attempts = cefr_attempts + 1,
      cefr_run_id = ${workflowRunId},
      cefr_claimed_at = ${now}::timestamp
    WHERE id = ANY(${skillIds}::uuid[])
      AND target_language = ${targetLanguage}
      AND ${owesLevel}
      AND (
        cefr_claimed_at IS NULL
        OR cefr_run_id = ${workflowRunId}
        OR cefr_claimed_at < ${now}::timestamp - INTERVAL '10 minutes'
      )
    RETURNING id, name, description, level::text AS level
  `;

  return skillIds.flatMap((id) => claimed.find((skill) => skill.id === id) ?? []);
}

/**
 * Internal workflow bridge for one step: places a batch's skills in their bands and writes only the
 * levels still empty, so a retry or another run never changes one. Returns how many it wrote.
 */
export async function tagSkillLevels({
  analytics,
  batch,
  serviceTier,
  workflowRunId,
}: {
  analytics?: Analytics;
  batch: SkillLevelBatch;
  serviceTier?: ServiceTier;
  workflowRunId: string;
}): Promise<number> {
  const claimed = await claimAttempt({ batch, workflowRunId });

  if (claimed.length === 0) {
    return 0;
  }

  const { data } = await classifySkillLevels({
    analytics: { contentScope: "shared", ...analytics },
    serviceTier,
    skills: claimed.map((skill) => ({
      band: BAND_LEVELS[skill.level],
      description: skill.description,
      id: skill.id,
      name: skill.name,
    })),
    targetLanguage: batch.targetLanguage,
  });

  const written = await Promise.all(
    [...Map.groupBy(data.levels, (skill) => skill.level)].map(([cefrLevel, skills]) =>
      prisma.skill.updateMany({
        data: { cefrLevel },
        where: { cefrLevel: null, id: { in: skills.map((skill) => skill.id) } },
      }),
    ),
  );

  return written.reduce((sum, { count }) => sum + count, 0);
}

/**
 * Internal bridge for the daily sweep: skills still owing a level that a language plan's items or
 * saved graph use, through the skill a merged one became.
 */
export async function listOwedSkillLevels(): Promise<string[]> {
  const skills = await prisma.$queryRaw<{ id: string }[]>`
    WITH language_plans AS (
      SELECT plan.id, plan.graph
      FROM plans plan
      JOIN goals goal ON goal.id = plan.goal_id
      WHERE goal.kind = 'language'
    ),
    listed AS (
      SELECT item.skill_id AS id
      FROM plan_items item
      JOIN language_plans plan ON plan.id = item.plan_id
      UNION
      SELECT skill.id
      FROM language_plans plan
      CROSS JOIN LATERAL jsonb_path_query(plan.graph, '$.skills[*].skillId') AS graph_skill (id)
      JOIN skills skill ON skill.id::text = graph_skill.id #>> '{}'
    )
    SELECT id
    FROM skills
    WHERE id IN (
        SELECT COALESCE(skill.merged_into_id, skill.id)
        FROM listed
        JOIN skills skill ON skill.id = listed.id
      )
      AND ${owesLevel}
    ORDER BY id DESC
    LIMIT ${OWED_SKILLS_PER_SWEEP}
  `;

  return skills.map((skill) => skill.id);
}
