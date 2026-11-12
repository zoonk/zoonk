import { PlanLine } from "@/components/catalog/catalog-hero";
import { NoAccountStartNote } from "@/components/public/no-account-note";
import { StartBlock } from "@/components/public/public-start";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

export async function LessonCourseStart({
  className,
  route,
}: {
  className?: string;
  route: LibraryLessonRoute;
}) {
  const { chapter, course, lesson, number } = route;
  const t = await getExtracted();
  const startChapterId = number > 1 ? chapter.id : null;
  // Unique in the document, which may keep a visited lesson's page beside this one.
  const titleId = `lesson-course-${lesson.id}`;

  return (
    <section aria-labelledby={titleId} className={cn("max-w-column flex flex-col", className)}>
      <h2 className="text-section" id={titleId}>
        {t("Keep going with {course}", { course: course.title })}
      </h2>

      <PlanLine start={startChapterId ? "chapter" : "known"} />

      <StartBlock
        note={<NoAccountStartNote>{t("Start free, no account needed.")}</NoAccountStartNote>}
      >
        <StartPlanLink chapterId={startChapterId} courseId={course.id} secondary />
      </StartBlock>
    </section>
  );
}
