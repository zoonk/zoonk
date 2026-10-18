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
  // Partial credit and a fractional penalty leave decimals: "2,25" in Portuguese.
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

    return t("{correct} of {total} right", {
      correct: points(mock.correct),
      total: String(mock.total),
    });
  };
}

/**
 * One finished mock as a row, marked done as every finished thing is (its list holds only mocks,
 * so a kind's dot would say nothing): "Mock exam 3", its day and what it sat under it, and how it went in
 * the mono face at its end (under its day in a narrow column, `stacked`, such as a page's aside);
 * the whole row opens its result when it has one (`href`).
 */
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

  // A mock that asked fewer than the exam's questions says so beside what it sat.
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
