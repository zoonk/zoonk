"use client";

import {
  type ExamSpeakingFeedbackView,
  type SpeakingCriterionView,
  type SpeakingEstimate,
  type SpeakingTaskView,
} from "@zoonk/core/language/exam-speaking/contract";
import { useExtracted } from "next-intl";
import { useFormatter } from "../../_utils/formatter";

const POINT_DIGITS = 2;

type Standing = ExamSpeakingFeedbackView["criteria"][number]["standing"];

function span(low: string, high: string): string {
  return low === high ? low : `${low}–${high}`;
}

export function useCriterionGloss() {
  const t = useExtracted();

  const glosses: Record<string, string> = {
    accuracy: t("Accuracy"),
    coherence: t("Coherence"),
    discourse: t("Organizing what you say"),
    fluency: t("Fluency"),
    global: t("Overall impression"),
    grammar: t("Grammar"),
    grammarVocabulary: t("Grammar and vocabulary"),
    holistic: t("Overall impression"),
    interaction: t("Interaction"),
    interviewer: t("The examiner's overall rating"),
    language: t("Language"),
    languageUse: t("Use of language"),
    lexis: t("Vocabulary"),
    pronunciation: t("Pronunciation"),
    questions: t("Questions and answers"),
    range: t("Range of language"),
    taskCompletion: t("Doing the task"),
    vocabulary: t("Vocabulary"),
  };

  return (criterion: Pick<SpeakingCriterionView, "key" | "name">) =>
    glosses[criterion.key] ?? criterion.name;
}

/** Always marked as the AI. */
export function useTaskRoleLabel() {
  const t = useExtracted();

  return (role: SpeakingTaskView["role"]) =>
    role === "partner" ? t("With another candidate (AI)") : t("With an examiner (AI)");
}

export function useTaskRoleNoun() {
  const t = useExtracted();

  return (role: SpeakingTaskView["role"]) =>
    role === "partner" ? t("other candidate") : t("examiner");
}

export function useEstimateText() {
  const t = useExtracted();
  const format = useFormatter();

  const number = (value: number) => format.number(value, { maximumFractionDigits: POINT_DIGITS });

  return (estimate: SpeakingEstimate): string => {
    if (estimate.display === "letter") {
      return span(estimate.high, estimate.low);
    }

    const range = span(number(estimate.low), number(estimate.high));
    const max = number(estimate.max);

    return estimate.display === "points"
      ? t("{range} of {max} points", { max, range })
      : t("{range} of {max}", { max, range });
  };
}

export function useStandingText() {
  const t = useExtracted();

  return (standing: Standing, level: string) => {
    const texts = {
      at: t("At {level}", { level }),
      below: t("Below {level}", { level }),
      near: t("Near {level}", { level }),
    };

    return texts[standing];
  };
}
