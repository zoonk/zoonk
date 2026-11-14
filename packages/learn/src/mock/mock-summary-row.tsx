"use client";

import { type ExamMockSummary } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import {
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { useFormatMomentDay } from "../_utils/iso-date";
import { getMockSubject, useMockNumber } from "./mock-labels";

function useMeasureText() {
  const t = useExtracted();
  const points = useMockNumber();

  return (mock: ExamMockSummary): string => {
    if (mock.scoring === "net") {
      return t("{score} of {total}", { score: points(mock.measure), total: String(mock.total) });
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
  const formatDay = useFormatMomentDay();
  const measure = useMeasureText();
  const date = formatDay(mock.finishedAt);
  const subject = getMockSubject(mock);

  const content = (
    <>
      <ListRowLeading>
        <StatusMark status="done" />
      </ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{t("Mock exam {number}", { number: String(mock.number) })}</ListRowTitle>
          <ListRowDescription>{subject ? `${date} · ${subject}` : date}</ListRowDescription>
          {stacked && (
            <ListRowDescription className="font-mono tabular-nums">
              {measure(mock)}
            </ListRowDescription>
          )}
        </ListRowContent>
        {!stacked && <ListRowTrailing>{measure(mock)}</ListRowTrailing>}
      </ListRowBody>
    </>
  );

  return href ? <ListRowLink href={href}>{content}</ListRowLink> : <ListRow>{content}</ListRow>;
}
