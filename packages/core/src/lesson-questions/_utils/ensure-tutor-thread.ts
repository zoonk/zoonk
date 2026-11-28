import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type TutorSubject, getSubjectThreadColumn } from "./tutor-subject";

/** The thread a question goes into, made when the subject has none yet. */
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

  await transaction.lessonQuestionThread.createMany({ data: [data], skipDuplicates: true });

  return transaction.lessonQuestionThread.findFirst({ where });
}
