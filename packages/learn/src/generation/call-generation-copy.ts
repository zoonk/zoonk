"use client";

import { useExtracted } from "next-intl";
import { type KindCopy } from "./generation-copy-types";

export function useConversationCallCopy(): KindCopy<"conversationCall"> {
  const t = useExtracted();

  return {
    name: t("Writing your call"),
    phases: {
      write: {
        label: t("Writing the call for your level"),
        lines: [
          t("Choosing who you'll talk to…"),
          t("Writing what they say first…"),
          t("Picking what to get across…"),
          t("Adding phrases you can lean on…"),
        ],
      },
    },
  };
}

export function useSpeakingMockCopy(): KindCopy<"speakingMock"> {
  const t = useExtracted();

  return {
    name: t("Writing your mock"),
    phases: {
      write: {
        label: t("Writing the examiner's script"),
        lines: [
          t("Choosing your examiner…"),
          t("Writing the examiner's questions…"),
          t("Fitting the parts into about five minutes…"),
          t("Adding phrases you can lean on…"),
        ],
      },
    },
  };
}

export function useExamSpeakingCopy(): KindCopy<"examSpeaking"> {
  const t = useExtracted();

  return {
    name: t("Writing your task"),
    phases: {
      write: {
        label: t("Writing a card like the exam's"),
        lines: [
          t("Picking a new topic…"),
          t("Writing the card's instructions…"),
          t("Preparing what the examiner says…"),
          t("Adding phrases you can lean on…"),
        ],
      },
    },
  };
}
