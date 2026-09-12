import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";

/** A workflow identifier is not a capability token; every stream/status read resolves its persisted owner. */
export async function getGenerationReadAccess({ generationId }: { generationId: string }) {
  const session = await getSession();

  const courseWhere = {
    OR: [
      { organization: { kind: "brand" }, userId: null },
      ...(session ? [{ organizationId: null, userId: session.user.id }] : []),
    ],
  };

  const promptWhere = {
    OR: [{ courseId: null }, { course: { organization: { kind: "brand" }, userId: null } }],
  };

  const registered = await prisma.generationRun.findFirst({
    where: { OR: [{ course: courseWhere }, { coursePrompt: promptWhere }], id: generationId },
  });

  if (registered) {
    return { status: "ready" as const };
  }

  /** Older and child runs may predate API registration; their active claim still proves resource ownership. */
  const [course, chapter, lesson, prompt, discovery] = await Promise.all([
    prisma.course.findFirst({ where: { ...courseWhere, generationRunId: generationId } }),
    prisma.chapter.findFirst({ where: { course: courseWhere, generationRunId: generationId } }),
    prisma.lesson.findFirst({
      where: { chapter: { course: courseWhere }, generationRunId: generationId },
    }),
    prisma.coursePrompt.findFirst({ where: { ...promptWhere, generationRunId: generationId } }),
    session
      ? prisma.courseDiscovery.findFirst({
          where: { generationRunId: generationId, userId: session.user.id },
        })
      : null,
  ]);

  return course || chapter || lesson || prompt || discovery
    ? { status: "ready" as const }
    : { status: "notFound" as const };
}
