import { type MistakeCauseInput } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { type Mistake, prisma } from "@zoonk/db";
import { type MistakeSignals, inferMistakeCause } from "./mistake-cause";
import { type MistakeSnapshot } from "./mistake-snapshot";

/** A mistake whose pattern was ambiguous, waiting for the classifier to name its cause. */
export type MistakeCauseRequest = { input: MistakeCauseInput; mistakeId: string; userId: string };

type MistakeTarget = { itemId: string | null; stepId: string | null };

/** The open entry for the same question, so answering it wrong again doesn't add a duplicate. */
function findOpenMistake({ itemId, stepId, userId }: MistakeTarget & { userId: string }) {
  const targets = [itemId ? { itemId } : null, stepId ? { stepId } : null].filter(
    (target) => target !== null,
  );

  if (targets.length === 0) {
    return null;
  }

  return prisma.mistake.findFirst({ where: { OR: targets, status: "open", userId } });
}

function toCauseInput({
  language,
  signals,
  snapshot,
}: {
  language: string;
  signals: MistakeSignals;
  snapshot: MistakeSnapshot;
}): MistakeCauseInput {
  const { correct, total } = signals.recentSkillAnswers;

  return {
    correctAnswer: snapshot.correctAnswer ?? "",
    language,
    learnerAnswer: snapshot.answer ?? "",
    misconception: snapshot.misconception ?? "",
    question: snapshot.question,
    recentAccuracy: `${correct} of ${total} right`,
  };
}

/**
 * Adds a wrong answer to the notebook with its snapshot and, when the pattern is clear, its cause.
 * An ambiguous pattern leaves the cause empty and returns a request for the classifier, which runs
 * after the response so answering never waits on a model. A question already open in the notebook
 * keeps its entry.
 */
export async function recordMistake({
  attemptId,
  itemId,
  language,
  signals,
  skillId,
  snapshot,
  stepId,
  userId,
}: MistakeTarget & {
  attemptId: string;
  language: string;
  signals: MistakeSignals;
  skillId: string | null;
  snapshot: MistakeSnapshot;
  userId: string;
}): Promise<{ causeRequest: MistakeCauseRequest | null; mistake: Mistake }> {
  const existing = await findOpenMistake({ itemId, stepId, userId });

  if (existing) {
    return { causeRequest: null, mistake: existing };
  }

  const cause = inferMistakeCause(signals);

  const mistake = await prisma.mistake.create({
    data: { attemptId, cause, itemId, skillId, snapshot, stepId, userId },
  });

  const causeRequest = cause
    ? null
    : { input: toCauseInput({ language, signals, snapshot }), mistakeId: mistake.id, userId };

  return { causeRequest, mistake };
}
