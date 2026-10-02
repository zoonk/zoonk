import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { canViewLibraryRow } from "../../library/_utils/library-visibility";
import { getSession } from "../../users/get-session";

export type ViewerLesson =
  | { isGuest: boolean; lesson: { id: string; title: string }; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** The lesson, when the signed-in learner (or guest) may see it: shared, or their own private one. */
export async function findViewerLesson(lessonId: string): Promise<ViewerLesson> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(lessonId)) {
    return { status: "notFound" };
  }

  const lesson = await prisma.lesson.findUnique({
    select: { id: true, ownerId: true, title: true, visibility: true },
    where: { id: lessonId },
  });

  if (!lesson || !(await canViewLibraryRow(lesson))) {
    return { status: "notFound" };
  }

  return {
    isGuest: session.user.isAnonymous === true,
    lesson: { id: lesson.id, title: lesson.title },
    status: "ready",
    userId: session.user.id,
  };
}
