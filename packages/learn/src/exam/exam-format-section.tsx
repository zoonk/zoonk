"use client";

import { type ExamFormatDay } from "@zoonk/core/exams/view/contract";
import { useExtracted, useFormatter } from "next-intl";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { useFormatDuration } from "../_utils/time-format";
import { useExamScreen } from "./exam-context";
import { useExamDayDate } from "./exam-labels";

const FORMAT_TITLE_ID = "exam-format-title";

/** "The two days", "The exam day": the section's name by how many sittings the exam has. */
function useFormatTitle(days: number): string {
  const t = useExtracted();

  if (days === 1) {
    return t("The exam day");
  }

  return days === 2 ? t("The two days") : t("The {count, number} days", { count: days });
}

/**
 * "180 questions · Essay": what the whole exam holds, beside the header of an exam of several days.
 * One day's rows already say it, and beside "The exam day" it wrapped the title word by word.
 */
function useFormatDetail(format: readonly ExamFormatDay[]): string | null {
  const t = useExtracted();
  const parts = format.flatMap((day) => day.parts);

  const questions = parts.reduce(
    (sum, part) => sum + (part.written ? 0 : (part.questions ?? 0)),
    0,
  );

  const written = parts.filter((part) => part.written).map((part) => part.name);

  const count =
    questions > 0
      ? t("{count, plural, one {# question} other {# questions}}", { count: questions })
      : null;

  return [count, ...written].filter(Boolean).join(" · ") || null;
}

/** "Linguagens, Ciências Humanas and the essay · 90 questions": what a sitting holds. */
function useDayParts() {
  const t = useExtracted();
  const format = useFormatter();

  return (day: ExamFormatDay): string => {
    const questions = day.parts.reduce(
      (sum, part) => sum + (part.written ? 0 : (part.questions ?? 0)),
      0,
    );

    const parts = format.list(
      day.parts.map((part) => part.name),
      { type: "conjunction" },
    );

    return questions > 0
      ? t("{parts} · {count, plural, one {# question} other {# questions}}", {
          count: questions,
          parts,
        })
      : parts;
  };
}

/**
 * One sitting as one row: its number and day with how long it lasts, and what it holds under
 * them.
 */
function DayRow({ day, numbered }: { day: ExamFormatDay; numbered: boolean }) {
  const t = useExtracted();
  const dayDate = useExamDayDate();
  const dayParts = useDayParts();
  const formatDuration = useFormatDuration();

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5">
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        {numbered ? t("Day {number, number}", { number: day.day }) : null}
      </span>
      <span className="min-w-0 text-[0.8125rem] font-medium">
        {day.date ? dayDate(day.date) : t("Day {number, number}", { number: day.day })}
      </span>
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        {day.minutes !== null && day.minutes > 0 ? formatDuration(day.minutes) : null}
      </span>
      <span className="text-muted-foreground col-start-2 col-end-4 pt-0.5 text-xs text-pretty">
        {dayParts(day)}
      </span>
    </li>
  );
}

/**
 * The exam as its notice sets it out, day by day ("The two days"), in the page's aside: each
 * sitting's day and length over what it holds and its questions. The subjects and their topics
 * live on the Plan.
 */
export function ExamFormatSection() {
  const { exam } = useExamScreen();
  const title = useFormatTitle(exam.format.length);
  const detail = useFormatDetail(exam.format);

  return (
    <PageSection aria-labelledby={FORMAT_TITLE_ID} className="gap-1" data-slot="exam-format">
      <PageSectionHeader>
        <PageSectionTitle id={FORMAT_TITLE_ID}>{title}</PageSectionTitle>
        {detail && exam.format.length > 1 && <PageSectionDetail>{detail}</PageSectionDetail>}
      </PageSectionHeader>

      <ul aria-labelledby={FORMAT_TITLE_ID} className={LIST_GROUP_CLASS}>
        {exam.format.map((day) => (
          <DayRow day={day} key={day.day} numbered={exam.format.length > 1} />
        ))}
      </ul>
    </PageSection>
  );
}
