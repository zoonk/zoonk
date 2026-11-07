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
export function promptOutcomesSql(where: Sql): Sql {
  return sql`
    SELECT
      d.id,
      d.created_at,
      created.goal_ids,
      CASE
        WHEN d.status = 'failed' THEN 'failed'
        WHEN d.status = 'understanding' THEN 'inProgress'
        WHEN cardinality(created.goal_ids) > 0 THEN 'goalCreated'
        WHEN d.understanding->>'status' IN ('unclear', 'unsafe') THEN d.understanding->>'status'
        ELSE 'noGoal'
      END AS outcome
    FROM onboarding_drafts d
    JOIN users u ON u.id = d.user_id
    CROSS JOIN LATERAL (
      SELECT ARRAY(
        SELECT g.id
        FROM goals g
        WHERE g.user_id = d.user_id AND g.details->>'onboardingId' = d.id::text
        ORDER BY g.created_at
      ) AS goal_ids
    ) created
    WHERE ${where}
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
      select: { createdAt: true, id: true, kind: true, status: true, title: true },
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
