import "server-only";
import { postAsLearner } from "@/lib/api/learner-api";
import { type GoalView } from "@zoonk/core/goals/contract";
import { isResearchedGoalKind } from "@zoonk/core/goals/research";
import { getString } from "@zoonk/utils/json";

type GoalRef = Pick<GoalView, "id" | "kind">;

/**
 * The run writing a goal's curriculum or explanation, or null when it couldn't start: the goal's
 * screens offer to start it again.
 */
export type GoalWorkStart = { generationId: string | null; goalId: string };

/**
 * Research first, when the goal's kind needs it, so an exam's curriculum can wait for its notice.
 * Research that couldn't start doesn't hold the curriculum back: it's written from the goal.
 */
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

/**
 * Starts what goals need written, right after they're created (or when the learner tries again):
 * research for the goals that need it, then each goal's curriculum or quick explanation, as
 * `POST /v1/goals` does (`startGoalWork` in the API). Workflows run on the API, so this asks it
 * as the learner and waits for the answer: a start that failed is reported, never lost. A goal
 * that came with its plan (a plan link) skips research, since nothing waits for it.
 */
export async function startGoalWork(
  goals: GoalRef[],
  { research = true }: { research?: boolean } = {},
): Promise<GoalWorkStart[]> {
  return Promise.all(goals.map((goal) => startOne({ goal, research })));
}
