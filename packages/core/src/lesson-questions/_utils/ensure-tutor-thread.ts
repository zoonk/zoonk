import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type TutorSubject, findTutorThread, getSubjectThreadColumn } from "./tutor-subject";

/**
 * The thread a question goes into, made when the subject has none yet. A new plan conversation
 * starts from the original one; null when that conversation is gone.
 */
export async function ensureTutorThread({
  subject,
  transaction,
  userId,
}: {
  subject: TutorSubject;
  transaction: TransactionClient;
  userId: string;
}) {
  const where = { ...getSubjectThreadColumn(subject), userId };

  const data = {
    ...where,
    ...(subject.kind === "plan" && { createdAt: new Date() }),
    kind: subject.kind,
  };

  if (subject.kind === "plan" && subject.conversationId === null) {
    const original = await findTutorThread({ client: transaction, subject, userId });

    if (original.status !== "ready") {
      return null;
    }

    return original.thread ?? transaction.lessonQuestionThread.create({ data });
  }

  await transaction.lessonQuestionThread.createMany({ data: [data], skipDuplicates: true });

  return transaction.lessonQuestionThread.findFirst({ where });
}
