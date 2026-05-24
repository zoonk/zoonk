import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getCourseSuggestionReview = cache(async (
  entityId: string,
) => {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.searchPrompt.findUnique({
    include: { suggestions: { include: { courseSuggestion: true }, orderBy: { position: "asc" } } },
    where: { id: entityId },
  });
});

export const getStepImageReview = cache(async (entityId: string) => {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.step.findUnique({
    include: { lesson: { select: { kind: true, title: true } } },
    where: { id: entityId },
  });
});

export const getWordAudioReview = cache(async (entityId: string) => {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.word.findUnique({ where: { id: entityId } });
});

export const getSentenceAudioReview = cache(async (
  entityId: string,
) => {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.sentence.findUnique({ where: { id: entityId } });
});
