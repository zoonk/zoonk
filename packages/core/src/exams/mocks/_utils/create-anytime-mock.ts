import "server-only";
import { type Goal } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { type UsagePeriod } from "../../../entitlements/contract";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { getMockFormatMix } from "../mock-format-mix";
import { markPlannedItems } from "../mock-marking";
import { planOptionMock } from "../mock-option-plan";
import { type MockOption } from "../mock-options";
import { type MockCandidate, type MockPlan, countPlannedQuestions } from "../mock-plan";
import { isMockShort, listShortFormats } from "../mock-shortfall";
import {
  type AnytimeMockSetup,
  findRunningAnytimeMock,
  listMissingRecordings,
  loadMockSkillIds,
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
  option,
  plan,
  setup,
}: {
  candidates: readonly MockCandidate[];
  option: MockOption;
  plan: MockPlan;
  setup: AnytimeMockSetup;
}) {
  const mix = getMockFormatMix(setup.structure);

  return (
    listMissingRecordings({ option, setup }).length > 0 ||
    listShortFormats({ candidates, mix, option, plan }).length > 0
  );
}

export async function planFromBank({
  goal,
  option,
  setup,
  userId,
}: {
  goal: Goal;
  option: MockOption;
  setup: AnytimeMockSetup;
  userId: string;
}): Promise<{ candidates: MockCandidate[]; plan: MockPlan }> {
  const candidates = await loadMockCandidates({
    goal,
    itemIds: null,
    skillIds: await loadMockSkillIds(goal.id),
    structure: setup.structure,
    userId,
  });

  return {
    candidates,
    plan: planOptionMock({
      candidates,
      essays: setup.essays,
      listening: setup.listening,
      option,
      speaking: setup.speaking,
      structure: setup.structure,
    }),
  };
}

function toConditions({
  candidates,
  goal,
  option,
  plan,
  setup,
}: {
  candidates: readonly MockCandidate[];
  goal: Goal;
  option: MockOption;
  plan: MockPlan;
  setup: AnytimeMockSetup;
}): MockConditions {
  const edition = setup.blueprint ? readBlueprintContent(setup.blueprint).edition : null;
  const asked = countPlannedQuestions(plan);

  return {
    day: plan.day,
    examQuestions: asked < option.questions ? option.questions : null,
    fullLength: option.kind === "full",
    ...markPlannedItems({
      candidates: [...candidates, ...[...setup.listening.values()].flat()],
      plan,
      structure: setup.structure,
    }),
    partialCredit: getPartialCredit(setup.structure),
    purpose: "practice",
    reused: plan.reused,
    scoring: getMockScoring({ blueprint: setup.blueprint, goal, structure: setup.structure }),
    sections: plan.sections,
    shape: { area: option.area, day: option.day, kind: option.kind },
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    unpicked: option.leftOut.flatMap((part) =>
      part.part === "choice" && part.name ? [part.name] : [],
    ),
    wrongPenalty: getWrongPenalty(setup.structure),
  };
}

/**
 * Reuse a running mock; `needsQuestions` requires preparing questions before retrying with
 * `afterWriting`, which answers `short` when the mock still lacks questions.
 */
export async function createAnytimeMock({
  acceptFewer,
  afterWriting = false,
  goal,
  option,
  setup,
  userId,
  writesCap,
}: {
  acceptFewer: boolean;
  afterWriting?: boolean;
  goal: Goal;
  option: MockOption;
  setup: AnytimeMockSetup;
  userId: string;
  writesCap: UsagePeriod | null;
}): Promise<CreateAnytimeMockResult> {
  const { candidates, plan } = await planFromBank({ goal, option, setup, userId });
  const planned = countPlannedQuestions(plan);
  const asksEssays = plan.sections.some((section) => section.essays.length > 0);
  const shortOfNew = !acceptFewer && isShortOfNew({ candidates, option, plan, setup });
  const asksForNew = !afterWriting && writesCap === null && shortOfNew;

  const short =
    !acceptFewer &&
    !asksForNew &&
    planned >= MIN_CHECKPOINT_QUESTIONS &&
    isMockShort({ option, planned });

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
        examQuestions: option.questions,
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

    const conditions = toConditions({ candidates, goal, option, plan, setup });

    const created = await tx.mockExam.create({
      data: {
        conditions,
        examBlueprintId: setup.blueprint?.id ?? null,
        goalId: goal.id,
        sectionStartedAt: now,
        startedAt: now,
        userId,
      },
    });

    // The speaking paper is written while the learner sits the papers before it.
    if (conditions.sections.some((section) => section.kind === "speaking")) {
      await oweFollowUps({
        db: tx,
        followUps: [{ input: { mockId: created.id }, kind: "writeSpeakingPaper" }],
        userId,
      });
    }

    return { id: created.id, status: "started" };
  });
}
