"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageSectionTitle } from "../_components/page";
import { useKeepLearning } from "./today-action";
import { PlanLessonRow } from "./today-block-row";
import { useUpNextLessons } from "./use-today-copy";

const UP_NEXT_TITLE_ID = "today-up-next-title";

/**
 * "Up next in your plan" under a day with nothing left to start: the lessons "Keep learning" adds,
 * in the plan's order, drawn as the day's queue draws lessons still to do. The first is highlighted
 * and opens like "Keep learning" does, as the queue's next row opens like Start. Will had Sunday
 * off in his plan and wanted to study anyway: Today showed only "Study for 10 minutes", which gave
 * him practice instead of his next lessons, as if none were left. Being done for the day, or
 * resting, never hides what comes next.
 */
export function TodayUpNext({ className }: { className?: string }) {
  const t = useExtracted();
  const lessons = useUpNextLessons();
  const keep = useKeepLearning();

  if (lessons.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={UP_NEXT_TITLE_ID}
      className={cn("flex flex-col gap-2", className)}
      data-slot="today-up-next"
    >
      <PageSectionTitle id={UP_NEXT_TITLE_ID}>{t("Up next in your plan")}</PageSectionTitle>

      <ol className="flex flex-col">
        {lessons.map((lesson, index) => (
          <PlanLessonRow
            busy={keep.isPending}
            // oxlint-disable-next-line react/no-array-index-key -- two plan lessons can share a title, and a read replaces the list whole.
            key={index}
            minutes={lesson.minutes}
            onOpen={index === 0 ? keep.run : null}
            title={lesson.title}
          />
        ))}
      </ol>
    </section>
  );
}
