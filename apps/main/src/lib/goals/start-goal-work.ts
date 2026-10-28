import "server-only";
import { postAsLearner } from "@/lib/api/learner-api";
import { type GoalView } from "@zoonk/core/goals/contract";
import { isResearchedGoalKind } from "@zoonk/core/goals/research";
import { getString } from "@zoonk/utils/json";

type GoalRef = Pick<GoalView, "id" | "kind">;

export type GoalWorkStart = { generationId: string | null; goalId: string };

/** Research that couldn't start doesn't hold the curriculum back: it's written from the goal. */
async function startResearch(goal: GoalRef): Promise<string | null> {
  if (!isResearchedGoalKind(goal.kind)) {
    return null;
  }

  const research = await postAsLearner({ body: { goalId: goal.id }, path: "/v1/research" });
  return research.ok ? getString(research.json, "id") : null;
}

async function startOne({
  goal,
  research,
}: {
  goal: GoalRef;
  research: boolean;
}): Promise<GoalWorkStart> {
  const researchId = research ? await startResearch(goal) : null;
  const query = researchId ? `?researchId=${encodeURIComponent(researchId)}` : "";

  const generation = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goal.id)}/generations${query}`,
  });

  return {
    generationId: generation.ok ? getString(generation.json, "generationId") : null,
    goalId: goal.id,
  };
}

/** Waits for the API's answer, so a start that failed is reported, never lost. */
export async function startGoalWork(
  goals: GoalRef[],
  { research = true }: { research?: boolean } = {},
): Promise<GoalWorkStart[]> {
  return Promise.all(goals.map((goal) => startOne({ goal, research })));
}
