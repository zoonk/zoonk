"use client";

import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PlusMark } from "../_components/plus-lock";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useExamScreen } from "./exam-context";

/**
 * The next weekly mock exam as a row of the mocks' list, one tap from its intro, when one is coming:
 * a short version (half the exam day) on regular weeks, the full exam in the final stretch, its
 * day and questions under it and "Next" at its end. Without Plus it's there all the same, marked
 * Plus; its intro says what Plus unlocks.
 */
export function ExamNextMock() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { exam, hrefs } = useExamScreen();
  const next = exam.nextMock;

  if (!next) {
    return null;
  }

  const questions = t("{count, plural, one {# question} other {# questions}}", {
    count: next.questions,
  });

  return (
    <ListRowLink href={hrefs.challenge(next.planItemId)}>
      <ListRowLeading>
        <KindTile kind="mock" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{next.fullLength ? t("Full exam") : t("Short version")}</ListRowTitle>
        <ListRowDescription>
          {next.date
            ? `${formatDate(next.date, "weekday")}, ${formatDate(next.date, "long")} · ${questions}`
            : questions}
        </ListRowDescription>
      </ListRowContent>
      <ListRowTrailing>
        {exam.mocksRequirePlus && <PlusMark />}
        <span className="bg-muted text-muted-foreground inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold">
          {t("Up next")}
        </span>
      </ListRowTrailing>
    </ListRowLink>
  );
}
