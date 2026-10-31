import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { hasStudyGoal } from "../../goals/_utils/study-goal";
import { getOwnedGoal } from "../../learner/get-owned-goal";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { type PlayableLibraryLesson } from "../../lesson-player/playable-lesson";
import { readRelatedQuestions } from "../../library/explanations/save-explanation";
import { type ExplanationView } from "./explanation-contract";

export type ExplanationResult =
  | { explanation: ExplanationView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** The lesson's summary card is the "Now you know" recap, so the story itself ends at its check. */
function splitRecap(lesson: PlayableLibraryLesson) {
  const summary = lesson.steps.find((step) => step.kind === "summary");
  const recap = summary?.kind === "summary" ? summary.content.ideas.map((idea) => idea.text) : [];

  return {
    lesson: { ...lesson, steps: lesson.steps.filter((step) => step.kind !== "summary") },
    recap,
  };
}

function getOutline(lesson: PlayableLibraryLesson): string[] {
  return lesson.steps.flatMap((step) =>
    step.kind === "explanation" && step.content.title ? [step.content.title] : [],
  );
}

async function findGoFurtherCourse({
  courseId,
  userId,
}: {
  courseId: string | null;
  userId: string;
}) {
  if (!courseId) {
    return null;
  }

  const course = await prisma.course.findFirst({
    select: {
      _count: { select: { courseChapters: true } },
      description: true,
      id: true,
      organization: { select: { slug: true } },
      slug: true,
      title: true,
    },
    where: { OR: [{ visibility: "public" }, { userId }], id: courseId },
  });

  if (!course?.organization) {
    return null;
  }

  return {
    brandSlug: course.organization.slug,
    chapterCount: course._count.courseChapters,
    courseSlug: course.slug,
    description: course.description,
    id: course.id,
    title: course.title,
  };
}

async function findExplanationLessonId(goalId: string): Promise<string | null> {
  const item = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { kind: "lesson", lessonId: { not: null }, plan: { goalId } },
  });

  return item?.lessonId ?? null;
}

/** Requires ownership; read-only preparing state must not start generation. */
export async function getExplanation({ goalId }: { goalId: string }): Promise<ExplanationResult> {
  "use cache: private";

  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready" || owned.goal.kind !== "explain") {
    return owned.status === "unauthorized" ? owned : { status: "notFound" };
  }

  const { goal, userId } = owned;
  const details = isJsonObject(goal.details) ? goal.details : {};

  const [lessonId, course, studyGoal] = await Promise.all([
    findExplanationLessonId(goal.id),
    findGoFurtherCourse({ courseId: goal.primaryCourseId, userId }),
    hasStudyGoal(userId),
  ]);

  const played = lessonId ? await getPlayableLibraryLesson({ lessonId }) : null;
  const ready = played?.status === "ready" ? splitRecap(played.lesson) : null;

  return {
    explanation: {
      generationId: goal.generationRunId,
      goFurther: { course, questions: readRelatedQuestions(details) },
      goalId: goal.id,
      hasStudyGoal: studyGoal,
      lesson: ready?.lesson ?? null,
      outline: ready ? getOutline(ready.lesson) : [],
      question: typeof details.question === "string" ? details.question : goal.prompt,
      recap: ready?.recap ?? [],
      status: ready ? "ready" : "preparing",
      title: goal.title,
    },
    status: "ready",
  };
}
