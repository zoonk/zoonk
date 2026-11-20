"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  CURRENT_ROW_CLASS,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { useExamScreen } from "./exam-context";
import { useExamQuestionCount } from "./use-exam-question-count";

export function ExamNextMock({ current }: { current: boolean }) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const questionCount = useExamQuestionCount();
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
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{t("Next mock exam")}</ListRowTitle>
          <ListRowDescription>{questionCount(next.questions)}</ListRowDescription>
        </ListRowContent>
        {next.date && <ListRowTrailing>{formatPlanDate(next.date)}</ListRowTrailing>}
      </ListRowBody>
    </ListRowLink>
  );
}
