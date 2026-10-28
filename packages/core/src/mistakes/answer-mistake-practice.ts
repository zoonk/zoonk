import "server-only";
import { type Attempt, type Mistake, type MistakeStatus, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import {
  findSavedAttempt,
  getAnswerAttemptId,
  recordAnswerOnce,
} from "../learner/_utils/answer-once";
import {
  type ChoiceItem,
  getChoiceCorrectAnswer,
  getQuestionText,
  gradeChoiceAnswer,
  parseChoiceItem,
} from "../learner/_utils/choice-items";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { loadSkillSurvivors } from "../learner/_utils/update-learner-skill";
import { type LearnerAnswer } from "../learner/record-learner-answer";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { ITEM_SET_INCLUDE } from "../library/items/item-sets";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { NOTHING_REACHED, type Reached } from "../sessions/reached";
import { getSession } from "../users/get-session";
import { readFixedMistakeIds } from "./_utils/practice-runs";
import { type MistakePracticeAnswerInput } from "./contract";
import { applyDrillRules } from "./drill-answer";
import { finishMistakePractice } from "./finish-mistake-practice";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { scheduleMistakeCause } from "./resolve-mistake-cause";

type MistakePracticeFeedback = {
  answerId: string;
  correctAnswer: ReturnType<typeof getChoiceCorrectAnswer>;
  explanation: string | null;
  /** True only when this answer changed the targeted entry from open to fixed. */
  fixed: boolean;
  /** Includes fixes to overlapping entries, not only the targeted mistake. */
  fixedMistakeIds: string[];
  isCorrect: boolean;
  mistakeStatus: MistakeStatus;
  reached: Reached;
  trap: string | null;
};

export type MistakePracticeAnswerResult =
  | { feedback: MistakePracticeFeedback; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function loadOwnerSkillIds({
  skillId,
  userId,
}: {
  skillId: string;
  userId: string;
}): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: {
      lesson: { skills: { some: { skillId } } },
      plan: { goal: { userId } },
      skillId: { not: null },
    },
  });

  const ownerIds = items.flatMap((item) => item.skillId ?? []);
  const survivorOf = await loadSkillSurvivors(ownerIds);

  return [...new Set(ownerIds.flatMap((id) => [id, survivorOf(id)]))];
}

/** Eligible practice includes a mistake's original question and its owning goal skill's questions. */
async function findPracticeItem({
  itemId,
  mistake,
  userId,
}: {
  itemId: string;
  mistake: { itemId: string | null; skillId: string | null };
  userId: string;
}): Promise<ChoiceItem | null> {
  const item = await prisma.item.findUnique({
    include: { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE },
    where: { id: itemId },
  });

  if (!item || mistake.skillId === null) {
    return item && item.id === mistake.itemId ? parseChoiceItem(item) : null;
  }

  if (item.id === mistake.itemId || item.skillId === mistake.skillId) {
    return parseChoiceItem(item);
  }

  const owners = await loadOwnerSkillIds({ skillId: mistake.skillId, userId });
  return owners.includes(item.skillId) ? parseChoiceItem(item) : null;
}

type SavedPracticeAnswer = {
  answerId: string;
  fixedMistakeIds: string[];
  isCorrect: boolean;
  mistakeStatus: MistakeStatus;
};

/** Replays the saved verdict without recording another answer. */
function fromSavedAttempt({
  attempt,
  mistake,
}: {
  attempt: Pick<Attempt, "answer" | "id" | "isCorrect">;
  mistake: Pick<Mistake, "status">;
}): SavedPracticeAnswer {
  return {
    answerId: attempt.id,
    fixedMistakeIds: readFixedMistakeIds(attempt.answer),
    isCorrect: attempt.isCorrect,
    mistakeStatus: mistake.status,
  };
}

async function recordPracticeAnswer({
  answer,
  mistake,
}: {
  answer: LearnerAnswer;
  mistake: Pick<Mistake, "id" | "status">;
}): Promise<SavedPracticeAnswer> {
  const outcome = await recordAnswerOnce({ answer });

  if (outcome.status === "saved") {
    return fromSavedAttempt({ attempt: outcome.saved, mistake });
  }

  if (outcome.status !== "recorded") {
    throw new Error("A practice answer has no run or block to close");
  }

  const { recorded } = outcome;
  scheduleMistakeCause(recorded.causeRequest);

  return {
    answerId: recorded.attempt.id,
    fixedMistakeIds: recorded.fixedMistakeIds,
    isCorrect: recorded.attempt.isCorrect,
    mistakeStatus: recorded.mistake?.id === mistake.id ? recorded.mistake.status : mistake.status,
  };
}

/** A failed count leaves the answer saved; later answers or finish count all still-uncounted answers. */
async function countRunSoFar({
  answerId,
  input,
}: {
  answerId: string;
  input: MistakePracticeAnswerInput;
}): Promise<Reached> {
  const { run, timeZone } = input;

  if (!run) {
    return NOTHING_REACHED;
  }

  const { data, error } = await safeAsync(() =>
    finishMistakePractice({
      answerIds: [...run.answerIds, answerId],
      goalId: run.goalId,
      timeZone,
    }),
  );

  if (error) {
    logError("[answerMistakePractice] Failed to count the run:", error);
  }

  return data?.status === "ready" ? data.result.reached : NOTHING_REACHED;
}

/** Only later-local-day recall fixes a mistake; a timed answer using the full limit is wrong. Supplying run counts progress as it goes. */
export async function answerMistakePractice({
  input,
  mistakeId,
}: {
  input: MistakePracticeAnswerInput;
  mistakeId: string;
}): Promise<MistakePracticeAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const mistake = await prisma.mistake.findFirst({ where: { id: mistakeId, userId } });

  if (!mistake) {
    return { status: "notFound" };
  }

  const item = await findPracticeItem({ itemId: input.itemId, mistake, userId });

  if (!item) {
    return { status: "invalidItem" };
  }

  // Save the offered day before a correction can remove one of its missions.
  await saveDayBeforeActivity({ goalId: input.run?.goalId, timeZone: input.timeZone, userId });

  const graded = gradeChoiceAnswer({ answer: input.answer, item });
  const kind = getDrillKind(mistake.cause);

  const drilled = applyDrillRules({
    dontKnow: graded.dontKnow,
    drill: { kind, timeLimitSeconds: getDrillTimeLimitSeconds(kind) },
    durationMs: input.durationMs,
    isCorrect: graded.isCorrect,
    misconception: graded.snapshot.misconception ?? null,
  });

  const attemptId = input.attemptId
    ? getAnswerAttemptId({ key: input.attemptId, questionId: mistake.id, userId })
    : undefined;

  const earlier = attemptId ? await findSavedAttempt({ attemptId, userId }) : null;

  const saved = earlier
    ? fromSavedAttempt({ attempt: earlier, mistake })
    : await recordPracticeAnswer({
        answer: {
          answer: input.answer,
          attemptId,
          graded: { durationMs: input.durationMs, isCorrect: drilled.isCorrect },
          itemId: item.id,
          language: item.language,
          mistake: {
            questionText: getQuestionText(item),
            snapshot: graded.snapshot,
            timeLimitMs: drilled.timeLimitMs,
          },
          practicedMistakeId: mistake.id,
          purpose: "learning",
          skillId: item.skillId,
          timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
          userId,
        },
        mistake,
      });

  const reached = await countRunSoFar({ answerId: saved.answerId, input });

  const fixed = saved.fixedMistakeIds.includes(mistake.id);

  return {
    feedback: {
      answerId: saved.answerId,
      correctAnswer: getChoiceCorrectAnswer(item),
      explanation: graded.snapshot.explanation ?? null,
      fixed,
      fixedMistakeIds: saved.fixedMistakeIds,
      isCorrect: saved.isCorrect,
      mistakeStatus: fixed ? "fixed" : saved.mistakeStatus,
      reached,
      trap: drilled.trap,
    },
    status: "ready",
  };
}
