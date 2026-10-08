import "server-only";
import { type Goal, prisma, sql } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getExamScale } from "../../scoring/exam-scales";
import { type MockConditions } from "../mock-contract";
import { planOptionMock } from "../mock-option-plan";
import { type MockCandidate, type MockPlan, countPlannedQuestions } from "../mock-plan";
import { isMockShort } from "../mock-shortfall";
import { planPlacementMock } from "../placement-mock";
import {
  type AnytimeMockPick,
  type AnytimeMockSetup,
  findRunningAnytimeMock,
  loadMockSkillIds,
  loadPlacementSkills,
} from "./anytime-mock-setup";
import { loadMockCandidates } from "./mock-candidates";
import { getExamStartTime } from "./mock-conditions";
import { getMockScoring } from "./plan-weekly-mock";

/** Namespaces the per-goal start lock so it never collides with other advisory locks. */
const START_LOCK_NAMESPACE = 51_882;

export type CreateAnytimeMockResult =
  | { id: string; status: "running" | "started" }
  | { status: "notEnoughQuestions" }
  /** The bank holds fewer questions the learner hasn't seen than the option asks. */
  | { status: "needsQuestions" };

/**
 * The picked mock, planned from the questions the learner has never answered: one of the goal's
 * options, or a diagnostic one spread over the plan's topics.
 */
export async function planFromBank({
  goal,
  pick,
  setup,
  userId,
}: {
  goal: Goal;
  pick: AnytimeMockPick;
  setup: AnytimeMockSetup;
  userId: string;
}): Promise<{ candidates: MockCandidate[]; missingSkillIds: string[]; plan: MockPlan }> {
  const [candidates, skills] = await Promise.all([
    loadMockSkillIds(goal.id).then((skillIds) =>
      loadMockCandidates({ goal, itemIds: null, skillIds, structure: setup.structure, userId }),
    ),
    pick.purpose === "placement" ? loadPlacementSkills(goal.id) : [],
  ]);

  if (pick.purpose === "placement") {
    return {
      candidates,
      ...planPlacementMock({ candidates, option: pick.option, skills, structure: setup.structure }),
    };
  }

  return {
    candidates,
    missingSkillIds: [],
    plan: planOptionMock({ candidates, option: pick.option, structure: setup.structure }),
  };
}

function toConditions({
  goal,
  pick,
  plan,
  setup,
}: {
  goal: Goal;
  pick: AnytimeMockPick;
  plan: MockPlan;
  setup: AnytimeMockSetup;
}): MockConditions {
  const edition = setup.blueprint ? readBlueprintContent(setup.blueprint).edition : null;
  const { option, purpose } = pick;

  return {
    day: plan.day,
    fullLength: purpose === "practice" && option.kind === "full",
    purpose,
    scoring: getMockScoring({
      scale: getExamScale({ blueprint: setup.blueprint, goal }),
      structure: setup.structure,
    }),
    sections: plan.sections,
    shape:
      purpose === "practice" ? { area: option.area, day: option.day, kind: option.kind } : null,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
  };
}

/**
 * Starts a mock taken any time: the picked mock's questions from the shared bank, never one the
 * learner answered before, at the exam's pace, its first section's clock running. One at a time
 * per goal: a learner with one running continues it (two taps at once find the same one). A bank
 * short of the mock's questions answers `needsQuestions` so a run can write them first, unless the
 * caller accepts fewer.
 */
export async function createAnytimeMock({
  acceptFewer,
  goal,
  pick,
  setup,
  userId,
}: {
  acceptFewer: boolean;
  goal: Goal;
  pick: AnytimeMockPick;
  setup: AnytimeMockSetup;
  userId: string;
}): Promise<CreateAnytimeMockResult> {
  const { plan } = await planFromBank({ goal, pick, setup, userId });
  const planned = countPlannedQuestions(plan);

  return prisma.$transaction(async (tx): Promise<CreateAnytimeMockResult> => {
    await tx.$queryRaw(
      sql`SELECT pg_advisory_xact_lock(${START_LOCK_NAMESPACE}::int, hashtext(${goal.id}))::text`,
    );

    const running = await findRunningAnytimeMock({ client: tx, goalId: goal.id, userId });

    if (running) {
      return { id: running.id, status: "running" };
    }

    if (isMockShort({ option: pick.option, planned }) && !acceptFewer) {
      return { status: "needsQuestions" };
    }

    if (planned < MIN_CHECKPOINT_QUESTIONS) {
      return { status: "notEnoughQuestions" };
    }

    const now = new Date();

    const created = await tx.mockExam.create({
      data: {
        conditions: toConditions({ goal, pick, plan, setup }),
        examBlueprintId: setup.blueprint?.id ?? null,
        goalId: goal.id,
        sectionStartedAt: now,
        startedAt: now,
        userId,
      },
    });

    return { id: created.id, status: "started" };
  });
}
