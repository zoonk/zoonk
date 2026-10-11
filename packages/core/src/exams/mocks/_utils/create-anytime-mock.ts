import "server-only";
import { type Goal, prisma, sql } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { type UsagePeriod } from "../../../entitlements/contract";
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

/** Namespaces the per-goal start lock so it never collides with other advisory locks. */
const START_LOCK_NAMESPACE = 51_882;

export type CreateAnytimeMockResult =
  | { id: string; status: "running" | "started" }
  | { status: "notEnoughQuestions" }
  /** The bank holds fewer questions the learner hasn't seen than the option asks. */
  | { status: "needsQuestions" }
  /**
   * The bank holds too few of the option's questions (`isMockShort`) and none can be written now:
   * what the mock can ask and in how long, for the learner to start it knowingly (`acceptFewer`).
   * `limit` is the fair-use period that stops new ones being written; null when nothing more can
   * be written for it.
   */
  | {
      examQuestions: number;
      limit: UsagePeriod | null;
      minutes: number;
      questions: number;
      status: "short";
    };

/**
 * Whether a mock asks too few new questions, the rest being ones the learner answered, or too few
 * in one of the exam's formats (`listShortFormats`), or misses a listening section's recordings
 * (`listMissingRecordings`): they can be written for it first.
 */
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

/**
 * The picked mock, planned from the bank: one of the goal's options from the questions the learner
 * never answered, then the ones they answered for the rest (see `loadMockCandidates`), or a
 * diagnostic one spread over the plan's topics from new questions only, since it places the
 * learner.
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
    // Placement spreads its few questions over the plan's topics, one or two each: a set's several
    // questions on one text would crowd them out.
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

/**
 * Starts a mock taken any time: the picked mock's questions from the shared bank at the exam's
 * pace, its first section's clock running, the ones the learner never answered first. One at a
 * time per goal: a learner with one running continues it (two taps at once find the same one).
 * Unless the caller takes what there is (`acceptFewer`): a bank short of new questions answers
 * `needsQuestions` so a run can write them first, while the learner may have them written (no
 * `writesCap`); a mock still short of its questions answers `short`. Otherwise a mock of a subject
 * or half a day asks questions the learner answered before for the rest, and a full mock asks
 * fewer, saying how many of the exam's it asks (`examQuestions`).
 */
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
  /** What stops new questions being written for the learner's mocks now (`findMockQuestionsCap`). */
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

  return prisma.$transaction(async (tx): Promise<CreateAnytimeMockResult> => {
    await tx.$queryRaw(
      sql`SELECT pg_advisory_xact_lock(${START_LOCK_NAMESPACE}::int, hashtext(${goal.id}))::text`,
    );

    const running = await findRunningAnytimeMock({ client: tx, goalId: goal.id, userId });

    if (running) {
      return { id: running.id, status: "running" };
    }

    if (asksForNew) {
      return { status: "needsQuestions" };
    }

    if (short) {
      return {
        examQuestions: pick.option.questions,
        limit: shortOfNew ? writesCap : null,
        minutes: plan.minutes,
        questions: planned,
        status: "short",
      };
    }

    // A day that is all written asks its essays and no questions.
    if (planned < MIN_CHECKPOINT_QUESTIONS && !(planned === 0 && asksEssays)) {
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
