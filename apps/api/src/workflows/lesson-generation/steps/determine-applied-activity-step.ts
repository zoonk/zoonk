import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateAppliedActivityKind } from "@zoonk/ai/tasks/lessons/applied-activity-kind";
import { type AppliedActivityKind, type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

const MAX_RECENT_KINDS = 5;

/**
 * Finds applied activity kinds (story or investigation) assigned to
 * preceding lessons in the same chapter. Returns up to 5 kinds,
 * most recent first. This gives the classifier a diversity signal
 * so it can avoid repeating the same kind when the topic is ambiguous.
 */
async function getRecentAppliedKinds(
  chapterId: number,
  currentPosition: number,
): Promise<string[]> {
  const previousActivities = await prisma.activity.findMany({
    orderBy: { lesson: { position: "desc" } },
    select: { kind: true },
    take: MAX_RECENT_KINDS,
    where: {
      kind: { in: ["story", "investigation"] },
      lesson: { chapterId, position: { lt: currentPosition } },
    },
  });

  return previousActivities.map((activity) => activity.kind);
}

/**
 * Classifies whether this core lesson should include an applied activity
 * (story, investigation, etc).
 *
 * Non-fatal: if the classifier fails, the lesson proceeds without an
 * applied activity. This is an optional enhancement, not a structural
 * requirement.
 */
export async function determineAppliedActivityStep(
  context: LessonContext,
): Promise<AppliedActivityKind> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "determineAppliedActivity" });

  const recentAppliedKinds = await getRecentAppliedKinds(context.chapterId, context.position);

  const { data: result, error } = await safeAsync(() =>
    generateAppliedActivityKind({
      chapterTitle: context.chapter.title,
      concepts: context.concepts,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description ?? "",
      lessonTitle: context.title,
      recentAppliedKinds,
    }),
  );

  await stream.status({ status: "completed", step: "determineAppliedActivity" });

  if (error) {
    return null;
  }

  return result.data.appliedActivityKind;
}
