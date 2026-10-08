"use client";

import { type ExamFormatDay } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import {
  LIST_GROUP_CLASS,
  ListRow,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionLabel,
  PageSectionTitle,
} from "../_components/page";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useExamScreen } from "./exam-context";

const FORMAT_TITLE_ID = "exam-format-title";

/** "The two days", "The exam day": the section's name by how many sittings the exam has. */
function useFormatTitle(days: number): string {
  const t = useExtracted();

  if (days === 1) {
    return t("The exam day");
  }

  return days === 2 ? t("The two days") : t("The {count, number} days", { count: days });
}

/** "180 questions and the Redação": what the whole exam holds, beside the header. */
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

/** "Day 1 · November 8 · 5h 30m": the sitting's own label over its parts. */
function useDayLabel() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();

  return (day: ExamFormatDay): string =>
    [
      t("Day {number, number}", { number: day.day }),
      day.date && formatDate(day.date, "long"),
      day.minutes !== null && day.minutes > 0 && formatDuration(day.minutes),
    ]
      .filter(Boolean)
      .join(" · ");
}

function PartRow({ part }: { part: ExamFormatDay["parts"][number] }) {
  const t = useExtracted();

  return (
    <li>
      <ListRow>
        <ListRowContent>
          <ListRowTitle>{part.name}</ListRowTitle>
        </ListRowContent>
        {!part.written && part.questions !== null && (
          <ListRowTrailing>
            {t("{count, plural, one {# question} other {# questions}}", { count: part.questions })}
          </ListRowTrailing>
        )}
      </ListRow>
    </li>
  );
}

/**
 * The exam as its notice sets it out, day by day ("The two days"): each sitting's day, date and
 * time over its parts and their questions, so the learner knows what each day holds. The subjects
 * and their topics live on the Journey.
 */
export function ExamFormatSection() {
  const { exam } = useExamScreen();
  const title = useFormatTitle(exam.format.length);
  const detail = useFormatDetail(exam.format);
  const dayLabel = useDayLabel();

  return (
    <PageSection aria-labelledby={FORMAT_TITLE_ID} data-slot="exam-format">
      <PageSectionHeader>
        <PageSectionTitle id={FORMAT_TITLE_ID}>{title}</PageSectionTitle>
        {detail && <PageSectionDetail>{detail}</PageSectionDetail>}
      </PageSectionHeader>

      {exam.format.map((day) => {
        const labelId = `exam-format-day-${day.day}`;

        return (
          <div className="flex flex-col gap-2" key={day.day}>
            {exam.format.length > 1 && (
              <PageSectionLabel id={labelId}>{dayLabel(day)}</PageSectionLabel>
            )}

            <ul
              aria-labelledby={exam.format.length > 1 ? labelId : FORMAT_TITLE_ID}
              className={LIST_GROUP_CLASS}
            >
              {day.parts.map((part) => (
                <PartRow key={part.name} part={part} />
              ))}
            </ul>
          </div>
        );
      })}
    </PageSection>
  );
}
