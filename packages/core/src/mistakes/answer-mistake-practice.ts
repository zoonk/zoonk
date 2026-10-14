import "server-only";
import { type MistakeStatus, prisma } from "@zoonk/db";
import {
  type ChoiceItem,
  getChoiceCorrectAnswer,
  getQuestionText,
  gradeChoiceAnswer,
  parseChoiceItem,
} from "../learner/_utils/choice-items";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { loadSkillSurvivors } from "../learner/_utils/update-learner-skill";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { ITEM_SET_INCLUDE } from "../library/items/item-sets";
import { getSession } from "../users/get-session";
import { type MistakePracticeAnswerInput } from "./contract";
import { applyDrillRules } from "./drill-answer";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { scheduleMistakeCause } from "./resolve-mistake-cause";

/**
 * Feedback for one practice answer: the right answer, why, where the notebook entry stands, the
 * trap a trap drill names, and the answer's id, which finishing the run counts.
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

/**
 * Grades one answer from "Practice mistakes" and records it as learning, by the rules of the
 * mistake's drill (a timed drill's answer that takes the whole time box is wrong). Right on a later
 * day than the mistake, it fixes the entry (and any open entry for the same question); wrong, it
 * goes back in the notebook, with a new entry only for a question that wasn't there yet. The run
 * counts toward today when it's finished (`finishMistakePractice`).
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

  const graded = gradeChoiceAnswer({ answer: input.answer, item });
  const kind = getDrillKind(mistake.cause);

  const drilled = applyDrillRules({
    dontKnow: graded.dontKnow,
    drill: { kind, timeLimitSeconds: getDrillTimeLimitSeconds(kind) },
    durationMs: input.durationMs,
    isCorrect: graded.isCorrect,
    misconception: graded.snapshot.misconception ?? null,
  });

  const recorded = await recordLearnerAnswer({
    answer: input.answer,
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
  });

  scheduleMistakeCause(recorded.causeRequest);

  const fixed = recorded.fixedMistakeIds.includes(mistake.id);

  const currentStatus =
    recorded.mistake?.id === mistake.id ? recorded.mistake.status : mistake.status;

  return {
    feedback: {
      answerId: recorded.attempt.id,
      correctAnswer: getChoiceCorrectAnswer(item),
      explanation: graded.snapshot.explanation ?? null,
      fixed,
      fixedMistakeIds: recorded.fixedMistakeIds,
      isCorrect: drilled.isCorrect,
      mistakeStatus: fixed ? "fixed" : currentStatus,
      trap: drilled.trap,
    },
    status: "ready",
  };
}
