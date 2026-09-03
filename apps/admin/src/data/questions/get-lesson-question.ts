import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { lessonQuestionReviewInclude } from "./_utils/lesson-question-review-include";

export const getLessonQuestion = cacheAdminData((id: string) =>
  prisma.lessonQuestion.findUnique({
    include: lessonQuestionReviewInclude,
    omit: { contextSnapshot: true },
    where: { id },
  }),
);
