import "server-only";
import { type Sql, prisma, sql } from "@zoonk/db";

export const PROMPT_OUTCOMES = [
  "goalCreated",
  "noGoal",
  "unclear",
  "unsafe",
  "failed",
  "inProgress",
] as const;

export type PromptOutcome = (typeof PROMPT_OUTCOMES)[number];

export type PromptOutcomeRow = { goal_ids: string[]; id: string; outcome: PromptOutcome };

/**
 * Goals point back to the prompt only through `details.onboardingId`, so whether one was created
 * is decided here, in SQL, where the list can filter on it. Archived goals still count.
 */
export function promptOutcomesSql({
  page,
  where,
}: {
  page?: { limit: number; offset: number };
  where: Sql;
}): Sql {
  const pageSql = page
    ? sql`ORDER BY d.created_at DESC, d.id DESC LIMIT ${page.limit} OFFSET ${page.offset}`
    : sql``;

  return sql`
    WITH drafts AS (
      SELECT d.id, d.user_id, d.status, d.understanding, d.created_at
      FROM onboarding_drafts d
      JOIN users u ON u.id = d.user_id
      WHERE ${where}
      ${pageSql}
    ),
    created AS (
      SELECT g.user_id, g.details->>'onboardingId' AS draft_id, array_agg(g.id ORDER BY g.created_at) AS goal_ids
      FROM goals g
      WHERE g.user_id IN (SELECT user_id FROM drafts) AND g.details->>'onboardingId' IS NOT NULL
      GROUP BY g.user_id, g.details->>'onboardingId'
    )
    SELECT
      drafts.id,
      drafts.created_at,
      COALESCE(created.goal_ids, '{}') AS goal_ids,
      CASE
        WHEN drafts.status = 'failed' THEN 'failed'
        WHEN drafts.status = 'understanding' THEN 'inProgress'
        WHEN created.goal_ids IS NOT NULL THEN 'goalCreated'
        WHEN drafts.understanding->>'status' IN ('unclear', 'unsafe') THEN drafts.understanding->>'status'
        ELSE 'noGoal'
      END AS outcome
    FROM drafts
    LEFT JOIN created ON created.user_id = drafts.user_id AND created.draft_id = drafts.id::text
  `;
}

/** Keeps the order of `rows`, which decided which prompts to show. */
export async function loadPrompts(rows: PromptOutcomeRow[]) {
  const [drafts, goals] = await Promise.all([
    prisma.onboardingDraft.findMany({
      include: {
        user: { select: { email: true, id: true, isAnonymous: true, name: true, username: true } },
      },
      where: { id: { in: rows.map((row) => row.id) } },
    }),
    prisma.goal.findMany({
      select: {
        createdAt: true,
        id: true,
        kind: true,
        primaryCourse: { select: { id: true, title: true } },
        status: true,
        title: true,
      },
      where: { id: { in: rows.flatMap((row) => row.goal_ids) } },
    }),
  ]);

  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));

  return rows.flatMap((row) => {
    const draft = draftsById.get(row.id);

    if (!draft) {
      return [];
    }

    const createdGoals = row.goal_ids.flatMap((goalId) => goalsById.get(goalId) ?? []);
    return [{ ...draft, goals: createdGoals, outcome: row.outcome }];
  });
}
