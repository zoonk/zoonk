"use client";

import { useFormatMomentDate, useMomentDays } from "@zoonk/learn/dates";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { addIsoDays } from "@zoonk/utils/calendar-day";
import { useExtracted } from "next-intl";
import { useLessonQuestionController } from "./lesson-question-provider";

function useDayLabel() {
  const t = useExtracted();
  const formatDate = useFormatMomentDate();
  const { dayOf, today } = useMomentDays();

  return (date: Date): string => {
    const day = dayOf(date);

    if (day === today) {
      return t("Today");
    }

    if (day === addIsoDays({ day: today, days: -1 })) {
      return t("Yesterday");
    }

    return formatDate(date, "weekdayDay");
  };
}

function DayLabel({ children }: { children: string }) {
  return <p className="text-label text-center">{children}</p>;
}

export function TurnDay({ date, previous }: { date: Date; previous: Date | null }) {
  const dayLabel = useDayLabel();
  const { dayOf } = useMomentDays();

  if (!previous || dayOf(date) === dayOf(previous)) {
    return null;
  }

  return <DayLabel>{dayLabel(date)}</DayLabel>;
}

export function FirstDay() {
  const dayLabel = useDayLabel();
  const { dayOf, today } = useMomentDays();
  const { state } = useLessonQuestionController();
  const first = state.questions[0];

  if (!first || dayOf(first.createdAt) === today) {
    return null;
  }

  return <DayLabel>{dayLabel(new Date(first.createdAt))}</DayLabel>;
}

export function ConversationSkeleton() {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" role="status">
        {t("Loading the conversation…")}
      </p>
      <div aria-hidden="true" className="flex flex-col items-end gap-2">
        <Skeleton className="h-12 w-3/5 rounded-xl" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
