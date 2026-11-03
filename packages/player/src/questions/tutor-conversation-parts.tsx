"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted, useFormatter } from "next-intl";
import { useLessonQuestionController } from "./lesson-question-provider";

function useDayLabel() {
  const t = useExtracted();
  const format = useFormatter();
  const now = useMountTime();

  return (date: Date): string => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

    if (day === today) {
      return t("Today");
    }

    if (day === yesterday) {
      return t("Yesterday");
    }

    return format.dateTime(date, { day: "numeric", month: "long", weekday: "long" });
  };
}

function DayLabel({ children }: { children: string }) {
  return <p className="text-label text-center">{children}</p>;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function TurnDay({ date, previous }: { date: Date; previous: Date | null }) {
  const dayLabel = useDayLabel();

  if (!previous || isSameDay(date, previous)) {
    return null;
  }

  return <DayLabel>{dayLabel(date)}</DayLabel>;
}

export function FirstDay() {
  const dayLabel = useDayLabel();
  const now = useMountTime();
  const { state } = useLessonQuestionController();
  const first = state.questions[0];

  if (!first || isSameDay(new Date(first.createdAt), now)) {
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
