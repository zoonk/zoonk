"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted, useFormatter } from "next-intl";
import { useLessonQuestionController } from "./lesson-question-provider";

/** A question to start with, with the icon that says what it's about and a stable `id`. */
export type TutorSuggestion = { icon: React.ReactNode; id: string; label: string };

/**
 * The questions to start with, as chips right above the composer: one row that scrolls sideways on
 * phones, wrapping from `lg`.
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
    <ul
      aria-label={t("Suggestions")}
      className="-mx-4 flex scrollbar-none gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {suggestions.map((suggestion) => (
        <li className="shrink-0" key={suggestion.id}>
          <button
            className="bg-background hover:bg-muted/60 focus-visible:ring-ring/50 flex h-11 items-center gap-2 rounded-full border pr-4 pl-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] **:data-[slot=kind-tile]:size-7 **:data-[slot=kind-tile]:rounded-full"
            onClick={() => onSend(suggestion.label)}
            type="button"
          >
            {suggestion.icon}
            {suggestion.label}
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

function DayLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground text-center text-xs font-medium first-letter:uppercase">
      {children}
    </p>
  );
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

/** The day above the buddy's hello: the first message's, or today in a new conversation. */
export function FirstDay() {
  const dayLabel = useDayLabel();
  const now = useMountTime();
  const { state } = useLessonQuestionController();
  const first = state.questions[0];

  return <DayLabel>{dayLabel(first ? new Date(first.createdAt) : now)}</DayLabel>;
}
