"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted, useFormatter } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  LIST_GROUP_CLASS,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSectionLabel } from "../_components/page";
import { useMockShapeLabel } from "../mock/mock-labels";
import { useExamScreen } from "./exam-context";

type MockSummary = ExamView["mocks"][number];

function useMeasureText() {
  const t = useExtracted();

  return (mock: MockSummary): string => {
    // An IRT score is only ever an estimate shown as a range (on the Journey), so a past mock
    // shows what it certainly was: its right answers.
    if (mock.scoring === "net") {
      return t("Net {score} of {total}", {
        score: String(mock.measure),
        total: String(mock.total),
      });
    }

    return t("{correct} of {total} right", {
      correct: String(mock.correct),
      total: String(mock.total),
    });
  };
}

function MockRow({ mock }: { mock: MockSummary }) {
  const t = useExtracted();
  const format = useFormatter();
  const { hrefs } = useExamScreen();
  const measure = useMeasureText();
  const shapeLabel = useMockShapeLabel();
  const date = format.dateTime(new Date(mock.finishedAt), { day: "numeric", month: "short" });
  const label = shapeLabel(mock);

  const content = (
    <>
      <ListRowLeading>
        <KindTile kind="mock" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Mock exam {number}", { number: String(mock.number) })}</ListRowTitle>
        <ListRowDescription>{label ? `${date} · ${label}` : date}</ListRowDescription>
      </ListRowContent>
      <ListRowTrailing>{measure(mock)}</ListRowTrailing>
    </>
  );

  return (
    <li>
      {mock.blockId ? (
        <ListRowLink href={hrefs.mock(mock.blockId)}>{content}</ListRowLink>
      ) : (
        <ListRow>{content}</ListRow>
      )}
    </li>
  );
}

/** The mocks taken so far, under their label in the mocks' section, each opening its result; nothing before the first. */
export function ExamMocksSection() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.mocks.length === 0) {
    return null;
  }

  return (
    <>
      <PageSectionLabel id="exam-mocks-title">{t("Your mock exams")}</PageSectionLabel>

      <ol aria-labelledby="exam-mocks-title" className={LIST_GROUP_CLASS}>
        {exam.mocks.map((mock) => (
          <MockRow key={mock.finishedAt} mock={mock} />
        ))}
      </ol>
    </>
  );
}
