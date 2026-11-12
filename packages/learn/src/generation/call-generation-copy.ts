"use client";

import { useExtracted } from "next-intl";
import { type KindCopy } from "./generation-copy-types";

export function useConversationCallCopy(): KindCopy<"conversationCall"> {
  const t = useExtracted();

  return { name: t("Writing your call"), phases: { write: t("Writing the call for your level") } };
}

export function useSpeakingMockCopy(): KindCopy<"speakingMock"> {
  const t = useExtracted();

  return { name: t("Writing your mock"), phases: { write: t("Writing the examiner's script") } };
}

export function useExamSpeakingCopy(): KindCopy<"examSpeaking"> {
  const t = useExtracted();

  return { name: t("Writing your task"), phases: { write: t("Writing a card like the exam's") } };
}

export function useSpeakingPaperCopy(): KindCopy<"speakingPaper"> {
  const t = useExtracted();

  return {
    name: t("Writing your speaking paper"),
    phases: { write: t("Writing a card for each task") },
  };
}
