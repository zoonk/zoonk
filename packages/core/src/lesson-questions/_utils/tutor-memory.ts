import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { markMemoryFactsUsed } from "../../memory/_utils/mark-facts-used";
import { type MemoryFactForTask, findMemoryForTask } from "../../memory/get-memory-for-task";
import { type MemoryChange } from "../../memory/memory-contract";
import { updateMemoryFromActivity } from "../../memory/update-memory-from-activity";
import { findThreadSubject } from "./tutor-subject";

/** The tutor reads what helps it explain: how the learner learns and what they're working toward. */
const TUTOR_MEMORY_CATEGORIES = ["learning", "goals"] as const;

/**
 * What the learner's memory holds that could help the tutor answer this question, read while the
 * tutor may still decide to answer for everyone without it (`markTutorMemoryUsed` records what a
 * personal answer reads). Memory is a help, not a requirement: when it can't be read, the tutor
 * answers without it.
 */
export async function findTutorMemory({
  language,
  question,
  userId,
}: {
  language: string;
  question: string;
  userId: string;
}): Promise<MemoryFactForTask[]> {
  const { data: facts, error } = await safeAsync(() =>
    findMemoryForTask({
      analytics: { contentScope: "personal", distinctId: userId },
      categories: TUTOR_MEMORY_CATEGORIES,
      includeSensitive: true,
      language,
      need: `A tutor answering the learner's question about their studies: ${question}`,
      userId,
    }),
  );

  if (error) {
    logError(`Could not read memory for the tutor of learner ${userId}.`, error);
    return [];
  }

  return facts;
}

/**
 * The facts a personal answer reads, recorded as used so stale ones can be reviewed. A failed
 * record doesn't keep the tutor from answering.
 */
export async function markTutorMemoryUsed({
  facts,
  userId,
}: {
  facts: readonly MemoryFactForTask[];
  userId: string;
}): Promise<string[]> {
  const { error } = await safeAsync(() =>
    markMemoryFactsUsed({ ids: facts.map((fact) => fact.id), now: new Date(), userId }),
  );

  if (error) {
    logError(`Could not record the memory the tutor read for learner ${userId}.`, error);
  }

  return facts.map((fact) => fact.statement);
}

/** Learns from a saved personal answer; nothing for a shared or unsaved one. */
async function learnFromExchange({
  questionId,
  userId,
}: {
  questionId: string;
  userId: string;
}): Promise<MemoryChange[]> {
  const question = await prisma.lessonQuestion.findFirst({
    select: { answer: true, question: true, sharedAnswerId: true, status: true, thread: true },
    where: { id: questionId, thread: { userId } },
  });

  if (!question?.answer || question.status !== "completed" || question.sharedAnswerId) {
    return [];
  }

  const access = await findThreadSubject({ thread: question.thread, userId });

  if (access.status !== "ready") {
    return [];
  }

  return updateMemoryFromActivity({
    source: {
      id: questionId,
      kind: "chat",
      language: access.subject.language,
      messages: [
        { role: "learner", text: question.question },
        { role: "tutor", text: question.answer },
      ],
    },
    userId,
  });
}

/**
 * After the tutor's answer is saved, the exchange may teach memory something lasting, such as a
 * goal the learner mentioned. A failure is logged and the answer still counts.
 */
export async function rememberTutorExchange({
  questionId,
  userId,
}: {
  questionId: string;
  userId: string;
}): Promise<MemoryChange[]> {
  const { data: changes, error } = await safeAsync(() => learnFromExchange({ questionId, userId }));

  if (error) {
    logError(`Could not update memory after a tutor answer for learner ${userId}.`, error);
    return [];
  }

  return changes;
}
