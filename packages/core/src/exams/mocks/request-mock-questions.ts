import "server-only";
import { prisma } from "@zoonk/db";
import { getRequestPlatform } from "../../analytics/request-platform";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../learner/placement/placement-quick-format";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSkillArea } from "../../plans/planner/graph-areas";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import { loadAnytimeMockSetup, resolveAnytimeOption } from "./_utils/anytime-mock-setup";
import { planFromBank } from "./_utils/create-anytime-mock";
import { type AnytimeMockChoice } from "./mock-contract";
import { isOptionArea } from "./mock-options";
import { countPlannedQuestions } from "./mock-plan";
import { getMockQuestionsShortfall } from "./mock-shortfall";
import { getPlacementQuestionsShortfall } from "./placement-mock";

/**
 * `ready`: the bank holds the mock's questions, so it can start. `preparing`: the goal's skill
 * map is still being drawn (a goal in onboarding), so there's nothing to write for yet: ask again
 * soon. `start`: the caller starts a run
 * writing `questionsPerSkill` questions in `format` for `skillIds` (shared by every later learner
 * of the exam), whose analytics name the learner, their goal and the client that asked.
 * `refused`: the learner's AI help allowance doesn't cover it now.
 */
export type MockQuestionsRequest =
  | { status: "preparing" }
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      format: PlacementQuickFormat;
      questionsPerSkill: number;
      skillIds: string[];
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "invalidOption" | "notExam" | "notFound" | "plusRequired" | "unauthorized" };

/**
 * The plan's skills a mock asks about: its graph's, in the areas the mock asks. Null while the
 * graph has no skills yet.
 */
async function loadOptionSkillIds({
  goalId,
  option,
  structure,
}: {
  goalId: string;
  option: Parameters<typeof isOptionArea>[0]["option"];
  structure: ExamStructure | null;
}): Promise<string[] | null> {
  const plan = await prisma.plan.findUnique({ select: { graph: true }, where: { goalId } });
  const graph = parsePlanGraph(plan?.graph);

  if (graph.skills.length === 0) {
    return null;
  }

  return graph.skills
    .filter((skill) => isOptionArea({ area: getSkillArea({ graph, skill }), option, structure }))
    .map((skill) => skill.skillId);
}

/**
 * Decides what asking for a mock's questions does, when the learner taps to start one: when the
 * shared bank holds fewer questions they haven't answered than the mock asks, the mock's skills
 * that are short of their share get some written (in the exam's own format, shared with every
 * later learner of the exam), claimed as small AI help first; for a diagnostic mock, only the
 * topics its questions are spread over that have none. Nothing is written when the bank already
 * holds them.
 */
export async function requestMockQuestions({
  goalId,
  input,
}: {
  goalId: string;
  input: AnytimeMockChoice;
}): Promise<MockQuestionsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "exam") {
    return { status: "notExam" };
  }

  const [access, setup] = await Promise.all([
    getAnytimeMockAccess({ goal, timeZone: getAnswerTimeZone({ goal }) }),
    loadAnytimeMockSetup(goal),
  ]);

  if (access !== "open") {
    return { status: access };
  }

  const pick = resolveAnytimeOption({ choice: input, setup });

  if (!pick) {
    return { status: "invalidOption" };
  }

  const [planned, optionSkillIds] = await Promise.all([
    planFromBank({ goal, pick, setup, userId }),
    loadOptionSkillIds({ goalId, option: pick.option, structure: setup.structure }),
  ]);

  if (!optionSkillIds) {
    return { status: "preparing" };
  }

  const plannedQuestions = countPlannedQuestions(planned.plan);

  const shortfall =
    pick.purpose === "placement"
      ? getPlacementQuestionsShortfall({
          missingSkillIds: planned.missingSkillIds,
          option: pick.option,
          planned: plannedQuestions,
        })
      : getMockQuestionsShortfall({
          candidates: planned.candidates,
          option: pick.option,
          planned: plannedQuestions,
          skillIds: optionSkillIds,
        });

  if (!shortfall) {
    return { status: "ready" };
  }

  const decision = await claimAssist();

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  return {
    analytics: { distinctId: userId, goalId, platform: await getRequestPlatform() },
    format: getPlacementQuickFormat(setup.structure),
    questionsPerSkill: shortfall.questionsPerSkill,
    skillIds: shortfall.skillIds,
    status: "start",
  };
}
