"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted, useFormatter } from "next-intl";
import { useLessonQuestionController } from "./lesson-question-provider";

/** A question to start with, and a stable `id`. */
export type TutorSuggestion = { id: string; label: string };

/**
 * The questions to start with, as small chips right above the composer, wrapping to a second line
 * when they don't fit, so none is cut at the screen's edge. Each keeps a 44px target.
 */
export function Suggestions({
  onSend,
  suggestions,
}: {
  onSend: (question: string) => void;
  suggestions: readonly TutorSuggestion[];
}) {
  const t = useExtracted();

  return (
    <ul aria-label={t("Suggestions")} className="flex flex-wrap gap-1.5">
      {suggestions.map((suggestion) => (
        <li className="min-w-0" key={suggestion.id}>
          <button
            className="text-muted-foreground ring-input hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area bg-background relative flex h-6.5 max-w-full items-center rounded-[0.375rem] px-2.5 text-xs font-medium ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px]"
            onClick={() => onSend(suggestion.label)}
            type="button"
          >
            <span className="truncate">{suggestion.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Today", "Yesterday" or the date: the day a stretch of the conversation is from. */
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

/** A day's name between stretches of the conversation, as a quiet section label. */
function DayLabel({ children }: { children: string }) {
  return <p className="text-label text-center">{children}</p>;
}

/** Whether two moments fall on the same calendar day, in the learner's clock. */
function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * A new day's label before its first message. The first message's day shows above the buddy's
 * hello instead.
 */
export function TurnDay({ date, previous }: { date: Date; previous: Date | null }) {
  const dayLabel = useDayLabel();

  if (!previous || isSameDay(date, previous)) {
    return null;
  }

  return <DayLabel>{dayLabel(date)}</DayLabel>;
}

/**
 * The day above the buddy's hello, once the conversation goes back further than today: its first
 * message's day. A conversation that's all from today needs no day.
 */
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
