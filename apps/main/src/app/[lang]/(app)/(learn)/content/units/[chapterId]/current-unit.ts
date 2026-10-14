import { type getPlanTabView } from "@zoonk/core/view-models/plan/get";

/**
 * Whether a unit holds the plan's next lesson: only then does its list mark its next one, as the
 * Plan marks the unit itself.
 */
export function isCurrentUnit({
  chapterId,
  plan,
}: {
  chapterId: string;
  plan: Awaited<ReturnType<typeof getPlanTabView>>;
}): boolean {
  if (plan.status !== "ready") {
    return false;
  }

  return plan.view.plan.phases
    .flatMap((phase) => phase.chapters)
    .some((chapter) => chapter.chapterId === chapterId && chapter.state === "current");
}
