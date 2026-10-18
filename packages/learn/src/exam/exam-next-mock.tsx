"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  CURRENT_ROW_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PlusMark } from "../_components/plus-lock";
import { StatusMark } from "../_components/status-mark";
import { useExamScreen } from "./exam-context";
import { useExamDayDate } from "./exam-labels";

/**
 * The next weekly mock exam as a row of the mocks' list, one tap from its intro, when one is
 * coming: half the exam (as the chooser names it) on regular weeks, the full exam in the final
 * stretch, its questions under it and its day at the row's end, as the taken ones' results are.
 * It's highlighted as the list's next one (`current`, the caller marking its item `aria-current`)
 * unless a mock the learner left running comes first. Without Plus it's there all the same, marked
 * Plus beside its name, and its intro says what Plus unlocks.
 */
export function ExamNextMock({ current }: { current: boolean }) {
  const t = useExtracted();
  const dayDate = useExamDayDate();
  const { exam, hrefs } = useExamScreen();
  const next = exam.nextMock;

  if (!next) {
    return null;
  }

  return (
    <ListRowLink
      className={cn(current && CURRENT_ROW_CLASS)}
      href={hrefs.challenge(next.planItemId)}
    >
      <ListRowLeading>
        <StatusMark status={current ? "next" : "todo"} />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className="flex items-center gap-2">
          {next.fullLength ? t("A full exam day") : t("Half an exam day")}
          {exam.mocksRequirePlus && <PlusMark />}
        </ListRowTitle>
        <ListRowDescription>
          {t("{count, plural, one {# question} other {# questions}}", { count: next.questions })}
        </ListRowDescription>
      </ListRowContent>
      {next.date && <ListRowTrailing>{dayDate(next.date)}</ListRowTrailing>}
    </ListRowLink>
  );
}
