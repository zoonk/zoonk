"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { PlanLessonRow } from "./today-block-row";
import { useTodayScreen } from "./today-context";
import { useDayState, useTodayPastDate } from "./use-today-copy";

const UP_NEXT_TITLE_ID = "today-up-next-title";

type UpNextLesson = TodayView["session"]["extraTime"]["lessons"][number];

/**
 * The plan's next lessons "Keep learning" adds, on a day with nothing left to start: a rest day,
 * or once the day's session is done. Empty on any other day, and when the time would go to
 * practice instead (every lesson is done) or isn't there to take.
 */
export function useUpNextLessons(): UpNextLesson[] {
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const { today } = useTodayScreen();
  const { extraTime } = today.session;

  if (pastDate || (state !== "done" && state !== "rest") || !extraTime.available) {
    return [];
  }

  return extraTime.lessons;
}

/**
 * "Up next in your plan" under a day with nothing left to start: the lessons "Keep learning" adds,
 * in the plan's order, drawn as the day's queue draws lessons still to do, the first highlighted
 * as where it goes on. Will had Sunday off in his plan and wanted to study anyway: Today showed
 * only "Study for 10 minutes", which gave him practice instead of his next lessons, as if none
 * were left. Being done for the day, or resting, never hides what comes next.
 */
export function TodayUpNext({ className }: { className?: string }) {
  const t = useExtracted();
  const lessons = useUpNextLessons();

  if (lessons.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={UP_NEXT_TITLE_ID}
      className={cn("flex flex-col gap-2", className)}
      data-slot="today-up-next"
    >
      <SectionLabel id={UP_NEXT_TITLE_ID}>{t("Up next in your plan")}</SectionLabel>

      <ol className="flex flex-col">
        {lessons.map((lesson, index) => (
          <PlanLessonRow
            isNext={index === 0}
            // oxlint-disable-next-line react/no-array-index-key -- two plan lessons can share a title, and a read replaces the list whole.
            key={index}
            minutes={lesson.minutes}
            title={lesson.title}
          />
        ))}
      </ol>
    </section>
  );
}
