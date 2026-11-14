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

function ExamMomentAction({ afterExam, href }: { afterExam: boolean; href: string }) {
  const t = useExtracted();

  return (
    <SuggestionLinkAction href={href} variant={useMainActionVariant()}>
      {afterExam ? t("Add your result") : t("See your exam")}
    </SuggestionLinkAction>
  );
}

function ExamMomentSuggestion({ href, moment }: { href: string; moment: ExamMomentView }) {
  const t = useExtracted();
  const copy = useExamMomentCopy(moment);

  if (!copy) {
    return null;
  }

  const Icon = EXAM_MOMENT_ICONS[moment.stage];

  return (
    <Suggestion data-slot="today-exam-moment" label={t("Your exam")} mark={<Icon />}>
      <SuggestionLine>
        <SuggestionSummary>{copy.title}</SuggestionSummary>
        <SuggestionOpen />
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{copy.title}</SuggestionHeader>
        <ExamMomentDay moment={moment} />
        <SuggestionDescription>
          <ExamMomentBody copy={copy} />
        </SuggestionDescription>
        <ExamChecklist items={moment.checklist} tools={moment.tools} />
        <SuggestionActions>
          <ExamMomentAction afterExam={moment.stage === "afterExam"} href={href} />
        </SuggestionActions>
      </SuggestionContent>
    </Suggestion>
  );
}

export function TodayExamMoment() {
  const { actions, today } = useTodayScreen();

  return today.exam && <ExamMomentSuggestion href={actions.examHref} moment={today.exam} />;
}
