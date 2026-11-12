import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { parseFeedbackMessageContext } from "@/data/feedback/_utils/feedback-message-context";
import { prisma } from "@zoonk/db";

const RECENT = 5;

/** What a person wrote to us and asked their buddy, newest first. Feedback text stays on its own page. */
export const listUserMessages = cacheAdminData(async (userId: string) => {
  const [feedback, questions] = await Promise.all([
    prisma.feedback.findMany({
      omit: { message: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECENT,
      where: { userId },
    }),
    prisma.lessonQuestion.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true, id: true, question: true },
      take: RECENT,
      where: { thread: { userId } },
    }),
  ]);

  return {
    feedback: feedback.map((row) => ({
      ...row,
      context: parseFeedbackMessageContext(row.context),
    })),
    questions,
  };
});
