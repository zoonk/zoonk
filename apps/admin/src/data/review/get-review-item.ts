import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getCourseSuggestionReview = cache(async function getCourseSuggestionReview(
  entityId: bigint,
) {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.searchPrompt.findUnique({
    include: {
      suggestions: {
        include: { courseSuggestion: true },
        orderBy: { position: "asc" },
      },
    },
    where: { id: Number(entityId) },
  });
});

export const getStepVisualReview = cache(async function getStepVisualReview(entityId: bigint) {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.step.findUnique({
    include: { activity: { select: { title: true } } },
    where: { id: entityId },
  });
});
