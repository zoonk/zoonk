"use client";

import { type ExamMomentView } from "@zoonk/core/exams/view/contract";
import { CalendarHeartIcon, FlagIcon, MessageCircleQuestionIcon, MoonIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  Suggestion,
  SuggestionContent,
  SuggestionLine,
  SuggestionOpen,
  SuggestionSummary,
} from "../_components/suggestion";
import { ExamMomentCard } from "../exam/exam-moment-card";
import { useTodayScreen } from "./today-context";

const ICONS = {
  afterExam: MessageCircleQuestionIcon,
  dayBefore: MoonIcon,
  examDay: CalendarHeartIcon,
  finalStretch: FlagIcon,
} as const;

/** The moment in a few words, as the line says it: "ENEM is tomorrow". */
function useMomentTitle() {
  const t = useExtracted();

  return (moment: Pick<ExamMomentView, "examName" | "stage">): string => {
    switch (moment.stage) {
      case "dayBefore":
        return t("{exam} is tomorrow", { exam: moment.examName });
      case "examDay":
        return t("{exam} is today", { exam: moment.examName });
      case "afterExam":
        return t("How did it go?");
      case "finalStretch":
        return t("The final stretch");
      default:
        return t("The final stretch");
    }
  };
}

/**
 * An exam goal's moment on Today (the final stretch, the day before, the exam day, "How did it
 * go?"), as Today's one notice: a line that opens the whole moment (what the day holds, what to
 * bring) in a sheet, or the moment itself in the aside.
 */
export function TodayExamMoment() {
  const t = useExtracted();
  const momentTitle = useMomentTitle();
  const { actions, today } = useTodayScreen();
  const moment = today.exam;

  if (!moment) {
    return null;
  }

  const Icon = ICONS[moment.stage];

  return (
    <Suggestion data-slot="today-exam-moment" label={t("Your exam")} mark={<Icon />}>
      <SuggestionLine>
        <SuggestionSummary>{momentTitle(moment)}</SuggestionSummary>
        <SuggestionOpen />
      </SuggestionLine>

      <SuggestionContent>
        <ExamMomentCard href={actions.examHref ?? null} moment={moment} />
      </SuggestionContent>
    </Suggestion>
  );
}
