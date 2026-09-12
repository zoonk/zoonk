import { type GenerationStatus, type Lesson, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type LearningPathChapter, getCourseLearningPath } from "../../courses/learning-plan";
import { NON_STANDALONE_GENERATED_LESSON_KINDS } from "../../lessons/generated-companion-kinds";
import { getSession } from "../../users/get-session";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

const preloadableGenerationStatuses = new Set<GenerationStatus>(["pending", "failed"]);
const maxPreloadTargets = 3;

type NextPreloadTarget =
  | { kind: "chapter"; chapterId: string }
  | { kind: "lesson"; lessonId: string };

/** Background work can use existing chapter grants, but never spend another chapter allowance. */
export async function getNextPreloadTargetResource({ lessonId }: { lessonId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(lessonId)) {
    return { status: "notFound" as const };
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getCompletableLessonWhere({ lessonId, userId: session.user.id }),
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  const path = await getCourseLearningPath({ courseId: lesson.chapter.courseId });

  if (path.status !== "ready" || (path.needsPlan && path.plan?.depth === "focused")) {
    return { status: "ready" as const, targets: [] };
  }

  const currentChapterIndex = path.chapters.findIndex((chapter) => chapter.id === lesson.chapterId);

  if (currentChapterIndex === -1) {
    return { status: "ready" as const, targets: [] };
  }

  const chapters = path.chapters.slice(currentChapterIndex);

  const grants = await prisma.chapterGenerationGrant.findMany({
    where: { chapterId: { in: chapters.map((chapter) => chapter.id) }, userId: session.user.id },
  });

  const funded = new Set(grants.map((grant) => grant.chapterId));

  return {
    status: "ready" as const,
    targets: getFundedPreloadTargets({ chapters, funded, lesson }),
  };
}

/** Stop at the next unfunded generation boundary rather than silently skipping ahead. */
function getFundedPreloadTargets({
  chapters,
  funded,
  lesson,
}: {
  chapters: LearningPathChapter[];
  funded: Set<string>;
  lesson: Pick<Lesson, "chapterId" | "position">;
}) {
  const targets: NextPreloadTarget[] = [];
  let inspected = 0;

  for (const chapter of chapters) {
    if (chapter.lessons.length === 0) {
      if (funded.has(chapter.id) && preloadableGenerationStatuses.has(chapter.generationStatus)) {
        targets.push({ chapterId: chapter.id, kind: "chapter" });
      }

      break;
    }

    const candidates = chapter.lessons.filter(
      (candidate) =>
        (chapter.id !== lesson.chapterId || candidate.position > lesson.position) &&
        !NON_STANDALONE_GENERATED_LESSON_KINDS.some((kind) => kind === candidate.kind),
    );

    for (const candidate of candidates) {
      inspected += 1;

      if (!candidate.isCompleted && preloadableGenerationStatuses.has(candidate.generationStatus)) {
        if (!funded.has(chapter.id)) {
          return targets;
        }

        targets.push({ kind: "lesson", lessonId: candidate.id });
      }

      if (inspected >= maxPreloadTargets) {
        return targets;
      }
    }
  }

  return targets;
}
