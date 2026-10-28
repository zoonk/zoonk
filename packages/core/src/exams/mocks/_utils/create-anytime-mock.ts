import "server-only";
import { type Goal } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { type UsagePeriod } from "../../../entitlements/contract";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { getMockFormatMix } from "../mock-format-mix";
import { planOptionMock } from "../mock-option-plan";
import { type MockCandidate, type MockPlan, countPlannedQuestions } from "../mock-plan";
import { isMockShort, listShortFormats } from "../mock-shortfall";
import { planPlacementMock } from "../placement-mock";
import {
  type AnytimeMockPick,
  type AnytimeMockSetup,
  findRunningAnytimeMock,
  listMissingRecordings,
  loadMockSkillIds,
  loadPlacementSkills,
} from "./anytime-mock-setup";
import { loadMockCandidates } from "./mock-candidates";
import { getExamStartTime } from "./mock-conditions";

export type CreateAnytimeMockResult =
  | { id: string; status: "running" | "started" }
  | { status: "notEnoughQuestions" }
  | { status: "needsQuestions" }
  | {
      examQuestions: number;
      limit: UsagePeriod | null;
      minutes: number;
      questions: number;
      status: "short";
    };

function isShortOfNew({
  candidates,
  pick,
  plan,
  setup,
}: {
  candidates: readonly MockCandidate[];
  pick: AnytimeMockPick;
  plan: MockPlan;
  setup: AnytimeMockSetup;
}) {
  if (pick.purpose === "placement") {
    return isMockShort({ option: pick.option, planned: countPlannedQuestions(plan) - plan.reused });
  }

  const mix = getMockFormatMix(setup.structure);

  return (
    listMissingRecordings({ pick, setup }).length > 0 ||
    listShortFormats({ candidates, mix, option: pick.option, plan }).length > 0
  );
}

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
    const fresh = candidates.filter((candidate) => !candidate.answered && !candidate.set);

    return {
      candidates: fresh,
      ...planPlacementMock({
        candidates: fresh,
        option: pick.option,
        skills,
        structure: setup.structure,
      }),
    };
  }

  return {
    candidates,
    missingSkillIds: [],
    plan: planOptionMock({
      candidates,
      essays: setup.essays,
      listening: setup.listening,
      option: pick.option,
      speaking: setup.speaking,
      structure: setup.structure,
    }),
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
  const asked = countPlannedQuestions(plan);

  return {
    day: plan.day,
    examQuestions: purpose === "practice" && asked < option.questions ? option.questions : null,
    fullLength: purpose === "practice" && option.kind === "full",
    partialCredit: getPartialCredit(setup.structure),
    purpose,
    reused: plan.reused,
    scoring: getMockScoring({ blueprint: setup.blueprint, goal, structure: setup.structure }),
    sections: plan.sections,
    shape:
      purpose === "practice" ? { area: option.area, day: option.day, kind: option.kind } : null,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    wrongPenalty: getWrongPenalty(setup.structure),
  };
}

/** Reuse a running mock; `needsQuestions` requires preparing questions before retrying without `acceptFewer`. */
export async function createAnytimeMock({
  acceptFewer,
  goal,
  pick,
  setup,
  userId,
  writesCap,
}: {
  acceptFewer: boolean;
  goal: Goal;
  pick: AnytimeMockPick;
  setup: AnytimeMockSetup;
  userId: string;
  writesCap: UsagePeriod | null;
}): Promise<CreateAnytimeMockResult> {
  const { candidates, plan } = await planFromBank({ goal, pick, setup, userId });
  const planned = countPlannedQuestions(plan);
  const asksEssays = plan.sections.some((section) => section.essays.length > 0);
  const shortOfNew = !acceptFewer && isShortOfNew({ candidates, pick, plan, setup });
  const asksForNew = writesCap === null && shortOfNew;

  const short =
    !acceptFewer &&
    !asksForNew &&
    pick.purpose === "practice" &&
    planned >= MIN_CHECKPOINT_QUESTIONS &&
    isMockShort({ option: pick.option, planned });

  return writeLearnerChange<CreateAnytimeMockResult>({ userId }, async (tx) => {
    const running = await findRunningAnytimeMock({ client: tx, goalId: goal.id, userId });

    if (running) {
      return unchanged({ id: running.id, status: "running" });
    }

    if (asksForNew) {
      return unchanged({ status: "needsQuestions" });
    }

    if (short) {
      return unchanged({
        examQuestions: pick.option.questions,
        limit: shortOfNew ? writesCap : null,
        minutes: plan.minutes,
        questions: planned,
        status: "short",
      });
    }

    if (planned < MIN_CHECKPOINT_QUESTIONS && !(planned === 0 && asksEssays)) {
      return unchanged({ status: "notEnoughQuestions" });
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
