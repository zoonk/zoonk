import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { markMemoryFactsUsed } from "../../memory/_utils/mark-facts-used";
import { type MemoryFactForTask, findMemoryForTask } from "../../memory/get-memory-for-task";
import { type MemoryChange } from "../../memory/memory-contract";
import { updateMemoryFromActivity } from "../../memory/update-memory-from-activity";
import { findThreadSubject } from "./tutor-subject";

const TUTOR_MEMORY_CATEGORIES = ["learning", "goals"] as const;

/** Memory failures never block an answer; markTutorMemoryUsed records only facts used in a personal answer. */
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

/** Recording failures do not block the answer. */
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

/** Call after saving the answer; memory failures are logged without undoing the answer. */
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
