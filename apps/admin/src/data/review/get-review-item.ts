import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

async function adminGuard() {
  const session = await getSession();
  return session?.user.role === "admin";
}

export async function getCourseSuggestionReview(entityId: bigint) {
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
}

export async function getStepVisualReview(entityId: bigint) {
  if (!(await adminGuard())) {
    return null;
  }

  return prisma.step.findUnique({
    include: { activity: { select: { title: true } } },
    where: { id: entityId },
  });
}

export async function getWordAudioReview(entityId: bigint) {
  if (!(await adminGuard())) {
    return null;
  }

  return prisma.word.findUnique({
    where: { id: entityId },
  });
}
