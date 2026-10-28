import "server-only";
import { type Goal } from "@zoonk/db";
import { getToolKey } from "../library/chapters/chapter-tools";
import {
  type SetupLesson,
  findOrCreateSetupLesson,
} from "../library/tools/find-or-create-setup-lesson";
import { applyChangeNow } from "./_utils/apply-plan-change";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { findCurrentPhase } from "./_utils/phase-states";
import { type PlanContext } from "./_utils/plan-context";
import { loadPlanAtToken } from "./_utils/plan-token";
import { type PlanTool, findToolAnchorSkill, loadPlanTools } from "./_utils/plan-tools";
import { withPlanRetry } from "./plan-conflict";
import { type PlanOperation, type PlanToolChoiceInput } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanOperationError } from "./planner/plan-operations";
import { type PlanGraph } from "./planner/plan-state";

export type PlanToolChoiceResult =
  | { change: PlanChangeView | null; status: "applied" }
  | { error: PlanOperationError | "unknownTool"; status: "invalid" }
  | { status: "notFound" | "unauthorized" };

/** For logs and admin only; the apps word a tool choice from its operation. */
const TOOLS_CHANGE_NOTE = "The learner chose how to use the plan's tools.";

type ChosenTool = { setup: SetupLesson | null; tool: PlanTool };

async function findChosenTools({
  context,
  names,
}: {
  context: PlanContext;
  names: readonly string[];
}): Promise<PlanTool[] | null> {
  const { goal, items, phases } = context;
  const currentPhase = findCurrentPhase({ items, phaseCount: phases.length });
  const planTools = await loadPlanTools({ currentPhase, goal, items });
  const keys = [...new Set(names.map((name) => getToolKey(name)))];
  const tools = keys.flatMap((key) => planTools.filter((tool) => tool.key === key));

  return tools.length === keys.length ? tools : null;
}

async function prepareSetups({
  goal,
  input,
  tools,
}: {
  goal: Goal;
  input: PlanToolChoiceInput;
  tools: readonly PlanTool[];
}): Promise<ChosenTool[]> {
  const { system } = input;

  return Promise.all(
    tools.map(async (tool) => ({
      setup:
        input.choice === "setup" && system
          ? await findOrCreateSetupLesson({
              analytics: {
                contentScope: tool.isPrivate ? "personal" : "shared",
                distinctId: goal.userId,
                goalId: goal.id,
              },
              language: goal.language,
              ownerId: tool.isPrivate ? goal.userId : null,
              system,
              tool: tool.name,
            })
          : null,
      tool,
    })),
  );
}

async function toOperations({
  chosen,
  graph,
  input,
}: {
  chosen: readonly ChosenTool[];
  graph: PlanGraph;
  input: PlanToolChoiceInput;
}): Promise<PlanOperation[]> {
  const setups = chosen.flatMap(({ setup, tool }) => (setup ? [{ setup, tool }] : []));

  const skills = await Promise.all(
    setups.map(async ({ setup, tool }) => ({
      area: null,
      beforeSkillId: await findToolAnchorSkill({ chapterIds: tool.chapterIds, graph }),
      lessons: 1,
      name: setup.title,
      skillId: setup.skillId,
    })),
  );

  const choices = chosen.map(({ setup, tool }) => ({
    choice: input.choice,
    name: tool.name,
    setupSkillId: setup?.skillId ?? null,
    system: input.choice === "setup" ? input.system : null,
  }));

  return [
    { kind: "setTools", tools: choices },
    ...(skills.length > 0 ? [{ kind: "addSkills" as const, skills }] : []),
  ];
}

export async function choosePlanTools({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanToolChoiceInput;
}): Promise<PlanToolChoiceResult> {
  const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned.context;

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goal.id, { timeZone: input.timeZone });

    if (!context) {
      return { status: "notFound" as const };
    }

    const tools = await findChosenTools({ context, names: input.tools });

    if (!tools) {
      return { error: "unknownTool" as const, status: "invalid" as const };
    }

    const chosen = await prepareSetups({ goal: context.goal, input, tools });

    const result = await applyChangeNow({
      context,
      followToday: true,
      operations: await toOperations({ chosen, graph: context.state.graph, input }),
      reason: TOOLS_CHANGE_NOTE,
      source: "learner",
    });

    if (result.status === "invalid") {
      return result;
    }

    const change = result.status === "saved" ? null : await loadPlanChangeView(result.changeId);

    return { change, status: "applied" as const };
  });
}
