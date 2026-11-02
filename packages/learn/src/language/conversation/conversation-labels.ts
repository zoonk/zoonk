"use client";

import {
  type LanguageConversationView,
  type SpeakingCriterion,
  type SpeakingMockExam,
} from "@zoonk/core/language/conversations/contract";
import { useExtracted } from "next-intl";

export function useSpeakingMockTitle() {
  const t = useExtracted();

  const titles: Record<SpeakingMockExam, string> = {
    ielts: t("IELTS speaking mock"),
    toefl: t("TOEFL speaking mock"),
  };

  return (exam: SpeakingMockExam) => titles[exam];
}

export function useConversationTitle(
  conversation: Pick<LanguageConversationView, "exam" | "examTask" | "kind">,
) {
  const t = useExtracted();
  const mockTitle = useSpeakingMockTitle();

  if (conversation.exam) {
    return mockTitle(conversation.exam);
  }

  if (conversation.examTask) {
    return conversation.examTask.title;
  }

  if (conversation.kind === "checkpoint") {
    return t("Unit challenge");
  }

  return t("Practice call");
}

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
