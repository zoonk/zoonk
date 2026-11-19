import { type Goal, prisma } from "@zoonk/db";

/**
 * Before the plan is shown, the lesson it opens with is being written for the learner to open
 * first, so a rebuild keeps it there; once the plan is shown, its days decide.
 */
export async function findWrittenStartLessonId(
  goal: Pick<Goal, "id" | "planRevealedAt">,
): Promise<string | null> {
  if (goal.planRevealedAt !== null) {
    return null;
  }

  const first = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { lesson: { select: { contentStatus: true, id: true } } },
    where: { kind: "lesson", plan: { goalId: goal.id }, status: "todo" },
  });

  const lesson = first?.lesson;
  const writing = lesson?.contentStatus === "running" || lesson?.contentStatus === "completed";

  return writing ? lesson.id : null;
}
