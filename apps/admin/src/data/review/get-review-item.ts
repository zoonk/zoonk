import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getCourseSuggestionReview = cacheAdminData(async (entityId: string) =>
  prisma.searchPrompt.findUnique({
    include: {
      suggestions: {
        include: { courseSuggestion: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
    },
    where: { id: entityId },
  }),
);

export const getStepImageReview = cacheAdminData(async (entityId: string) =>
  prisma.step.findUnique({
    include: { lesson: { select: { kind: true, title: true } } },
    where: { id: entityId },
  }),
);

export const getWordAudioReview = cacheAdminData(async (entityId: string) =>
  prisma.word.findUnique({ where: { id: entityId } }),
);

export const getSentenceAudioReview = cacheAdminData(async (entityId: string) =>
  prisma.sentence.findUnique({ where: { id: entityId } }),
);
