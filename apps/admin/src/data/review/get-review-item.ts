import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

async function adminGuard() {
  const session = await getSession();
  return session?.user.role === "admin";
}

export const getCourseSuggestionReview = cache(async function getCourseSuggestionReview(
  entityId: bigint,
) {
  if (!(await adminGuard())) {
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
  if (!(await adminGuard())) {
    return null;
  }

  return prisma.step.findUnique({
    include: { activity: { select: { title: true } } },
    where: { id: entityId },
  });
});

export const getWordAudioReview = cache(async function getWordAudioReview(entityId: bigint) {
  if (!(await adminGuard())) {
    return null;
  }

  return prisma.word.findUnique({
    where: { id: entityId },
  });
});
