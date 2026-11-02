"use client";

import { type ExamMockSummary } from "@zoonk/core/exams/view/contract";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { useMockShapeLabel } from "./mock-labels";

function useMeasureText() {
  const t = useExtracted();
  const format = useFormatter();
  const points = (value: number) => format.number(value, { maximumFractionDigits: 2 });

  return (mock: ExamMockSummary): string => {
    // An IRT score is only ever an estimate shown as a range (on the Plan), so a past mock
    // shows what it certainly was: its right answers.
    if (mock.scoring === "net") {
      return t("Net {score} of {total}", {
        score: points(mock.measure),
        total: String(mock.total),
      });
    }

    return t(
      "{correct, plural, =0 {# of {total} right} one {# of {total} right} other {# of {total} right}}",
      {
        // `#` shows up to three decimals; partial credit reads to the hundredth, as `points` does.
        correct: Math.round(mock.correct * 100) / 100,
        total: String(mock.total),
      },
    );
  };
}

export function MockSummaryRow({
  href,
  mock,
  stacked = false,
}: {
  href: string | null;
  mock: ExamMockSummary;
  stacked?: boolean;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const measure = useMeasureText();
  const shapeLabel = useMockShapeLabel();
  const date = format.dateTime(new Date(mock.finishedAt), { day: "numeric", month: "short" });
  const shape = shapeLabel(mock);

  const label =
    mock.examQuestions !== null && mock.examQuestions > mock.total
      ? t(
          "{shape}, {count, plural, one {# of {examQuestions, number} questions} other {# of {examQuestions, number} questions}}",
          { count: mock.total, examQuestions: mock.examQuestions, shape },
        )
      : shape;

  const content = (
    <>
      <ListRowLeading>
        <StatusMark status="done" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Mock exam {number}", { number: String(mock.number) })}</ListRowTitle>
        <ListRowDescription>{label ? `${date} · ${label}` : date}</ListRowDescription>
        {stacked && (
          <ListRowDescription className="font-mono tabular-nums">
            {measure(mock)}
          </ListRowDescription>
        )}
      </ListRowContent>
      {!stacked && <ListRowTrailing>{measure(mock)}</ListRowTrailing>}
    </>
  );

  return href ? <ListRowLink href={href}>{content}</ListRowLink> : <ListRow>{content}</ListRow>;
}
