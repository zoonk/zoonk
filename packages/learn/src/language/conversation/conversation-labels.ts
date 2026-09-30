"use client";

import {
  type LanguageConversationView,
  type SpeakingCriterion,
  type SpeakingMockExam,
} from "@zoonk/core/language/conversations/contract";
import { useExtracted } from "next-intl";
import { useExperienceMode } from "../../mode-provider";

/** A speaking mock's name, as its card and call header say it. */
export function useSpeakingMockTitle() {
  const t = useExtracted();

  const titles: Record<SpeakingMockExam, string> = {
    ielts: t("IELTS speaking mock"),
    toefl: t("TOEFL speaking mock"),
  };

  return (exam: SpeakingMockExam) => titles[exam];
}

/** What kind of call this is, as the header says it: Fun names a unit's checkpoint a boss. */
export function useConversationTitle(
  conversation: Pick<LanguageConversationView, "exam" | "kind">,
) {
  const t = useExtracted();
  const mode = useExperienceMode();
  const mockTitle = useSpeakingMockTitle();

  if (conversation.exam) {
    return mockTitle(conversation.exam);
  }

  if (conversation.kind === "checkpoint") {
    return mode === "fun" ? t("Unit boss") : t("Unit checkpoint");
  }

  return t("Practice call");
}

/**
 * The speaking criteria of both exams, as learners read them: IELTS's four, and TOEFL's Listen and
 * Repeat accuracy with the four read from the interview.
 */
export function useCriterionName() {
  const t = useExtracted();

  const names: Record<SpeakingCriterion, string> = {
    delivery: t("Pace and pronunciation"),
    elaboration: t("Clear, developed answers"),
    fluencyCoherence: t("Fluency and coherence"),
    grammar: t("Grammar"),
    lexicalResource: t("Vocabulary"),
    pronunciation: t("Pronunciation"),
    repetition: t("Repeating sentences"),
    vocabulary: t("Vocabulary"),
  };

  return (criterion: SpeakingCriterion) => names[criterion];
}
