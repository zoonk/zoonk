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

/**
 * Feedback for one practice answer: the right answer, why, where the notebook entry stands, the
 * trap a trap drill names, the answer's id, which finishing the run counts, and what counting the
 * run with it reached (a level, a tenth of Energy), for the run's end to celebrate.
 */
type MistakePracticeFeedback = {
  answerId: string;
  correctAnswer: ReturnType<typeof getChoiceCorrectAnswer>;
  explanation: string | null;
  /** This answer changed the practiced entry from open to fixed. */
  fixed: boolean;
  /** Every notebook entry this answer actually fixed, including overlapping drills. */
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

/**
 * The goal skills a finer skill counts for in the learner's own plans: the plan skills whose
 * lessons teach it, as `getSkillOwners` reads them. Practice drills a miss on a lesson screen,
 * which has no bank question of its own, with their questions.
 */
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

/**
 * Practice answers the mistake's own question, another question on its skill, or one on a goal
 * skill it counts for (a lesson screen's miss is drilled with those, see `getMistakePractice`).
 */
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

/** What a practice answer saved: its id, its verdict and the notebook entries it fixed. */
type SavedPracticeAnswer = {
  answerId: string;
  fixedMistakeIds: string[];
  isCorrect: boolean;
  mistakeStatus: MistakeStatus;
};

/** An answer saved earlier, sent again: what it saved then, never recorded twice. */
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

/**
 * Records the practice answer and schedules its cause, once when it came with an id: the same
 * answer sent twice at once gets what the first one saved.
 */
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

/**
 * Counts the run with this answer toward today, as `finishMistakePractice` does, and says what the
 * count reached. The answer is saved either way: a count that fails is made by the run's next
 * answer or its finish, which count every answer no count has yet.
 */
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

  // A count that failed is made by the run's next answer or its finish, which says what it reached.
  return data?.status === "ready" ? data.result.reached : NOTHING_REACHED;
}

/**
 * Grades one answer from "Practice mistakes" and records it as learning, by the rules of the
 * mistake's drill (a timed drill's answer that takes the whole time box is wrong). Right on a later
 * day than the mistake, it fixes the entry (and any open entry for the same question); wrong, it
 * goes back in the notebook, with a new entry only for a question that wasn't there yet. An answer
 * that names its run counts the run toward today as it goes; finishing the run
 * (`finishMistakePractice`) counts it too.
 */
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

  // A fixed mistake leaves what the day offers: today's day is saved before the first answer.
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
