import { DayList, type DayListStep } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { NoAccountStartNote } from "@/components/public/no-account-note";
import { StartBlock } from "@/components/public/public-start";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

const DAY_LESSONS = 3;

function getStepState({
  index,
  position,
}: {
  index: number;
  position: number;
}): DayListStep["state"] {
  if (position < index) {
    return "done";
  }

  return position === index ? "current" : "ahead";
}

function getDaySteps({
  chapter,
  lessonId,
}: {
  chapter: LibraryLessonRoute["chapter"];
  lessonId: string;
}): DayListStep[] {
  const index = chapter.lessons.findIndex((lesson) => lesson.id === lessonId);
  const start = Math.max(0, Math.min(index - 1, chapter.lessons.length - DAY_LESSONS));

  return chapter.lessons.slice(start, start + DAY_LESSONS).map((lesson, offset) => {
    const position = start + offset;

    return {
      detail: chapter.title,
      id: lesson.id,
      kind: "lesson",
      minutes: lesson.estimatedMinutes,
      state: getStepState({ index, position }),
      title: lesson.title,
    };
  });
}

export async function LessonPlanDay({
  className,
  route,
}: {
  className?: string;
  route: LibraryLessonRoute;
}) {
  const { chapter, course, lesson, number } = route;
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const steps = getDaySteps({ chapter, lessonId: lesson.id });
  const dayMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);
  // Unique in the document, which may keep a visited lesson's page beside this one.
  const titleId = `lesson-plan-${lesson.id}`;

  return (
    <section
      aria-labelledby={titleId}
      className={cn("max-w-column flex flex-col gap-5", className)}
    >
      <h2 className="text-section" id={titleId}>
        {t("This lesson is part of the {course} course.", { course: course.title })}
      </h2>

      <div className="flex flex-col gap-2">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-[0.9375rem] font-semibold">{t("Example plan")}</span>
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
            {t("{count, plural, one {# lesson} other {# lessons}}", { count: steps.length })}
            {" · "}
            {minutesText(dayMinutes)}
          </span>
        </p>

        <DayList minutesText={minutesText} steps={steps} />

        <p className="text-muted-foreground pt-2 text-[13px] leading-relaxed text-pretty">
          {t("An example. Your plan follows your answers, so it can start later and end sooner.")}
        </p>
      </div>

      <StartBlock
        className="mt-1 sm:mt-1"
        note={<NoAccountStartNote>{t("Start free, no account needed.")}</NoAccountStartNote>}
      >
        <StartPlanLink chapterId={number > 1 ? chapter.id : null} courseId={course.id} secondary />
      </StartBlock>
    </section>
  );
}
