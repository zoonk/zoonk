"use client";

import { type ExamMomentView } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import {
  Suggestion,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionSummary,
  useMainActionVariant,
} from "../_components/suggestion";
import { ExamChecklist } from "../exam/exam-checklist";
import {
  EXAM_MOMENT_ICONS,
  ExamMomentBody,
  ExamMomentDay,
  useExamMomentCopy,
} from "../exam/exam-moment-card";
import { useTodayScreen } from "./today-context";

/** The card's one action, which also names the folded line's opener on a phone. */
function useExamMomentActionLabel(moment: ExamMomentView): string {
  const t = useExtracted();
  return moment.stage === "afterExam" ? t("Add your result") : t("See your exam");
}

function ExamMomentAction({ href, label }: { href: string; label: string }) {
  return (
    <SuggestionLinkAction href={href} variant={useMainActionVariant()}>
      {label}
    </SuggestionLinkAction>
  );
}

function ExamMomentSuggestion({ href, moment }: { href: string; moment: ExamMomentView }) {
  const t = useExtracted();
  const copy = useExamMomentCopy(moment);
  const actionLabel = useExamMomentActionLabel(moment);

  if (!copy) {
    return null;
  }

  const Icon = EXAM_MOMENT_ICONS[moment.stage];

  return (
    <Suggestion data-slot="today-exam-moment" label={t("Your exam")} mark={<Icon />}>
      <SuggestionLine>
        <SuggestionSummary>{copy.title}</SuggestionSummary>
        <SuggestionOpen>{actionLabel}</SuggestionOpen>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{copy.title}</SuggestionHeader>
        <ExamMomentDay moment={moment} />
        <SuggestionDescription>
          <ExamMomentBody copy={copy} />
        </SuggestionDescription>
        <ExamChecklist items={moment.checklist} tools={moment.tools} />
        <SuggestionActions>
          <ExamMomentAction href={href} label={actionLabel} />
        </SuggestionActions>
      </SuggestionContent>
    </Suggestion>
  );
}

export function TodayExamMoment() {
  const { actions, today } = useTodayScreen();

  return today.exam && <ExamMomentSuggestion href={actions.examHref} moment={today.exam} />;
}
