"use client";

import {
  type NotPlannedReason,
  type SyllabusTopic,
} from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";

export function useNotPlannedReason() {
  const t = useExtracted();

  return function reasonText(reason: NotPlannedReason | null): string | null {
    if (reason === null) {
      return null;
    }

    switch (reason) {
      case "skipped":
        return t({
          description:
            "Why a topic, subject or step on the path isn't in the learner's plan: they took its subject out.",
          message: "Not in your plan · you took this subject out",
        });
      case "known":
        return t("Skipped · you already know it");
      case "pastBasics":
        return t("Skipped · you already know the basics");
      case "skippedBase":
        return t("Skipped · your choice");
      case "time":
        return t({
          description:
            "Why a topic, subject or step on the path isn't in the learner's plan: their study time doesn't reach it.",
          message: "Not in your plan · your time doesn't cover it",
        });
      case "missing":
        return t("Not ready yet");
      default:
        return null;
    }
  };
}

export function ReasonText({ reason }: { reason: NotPlannedReason | null }) {
  const reasonText = useNotPlannedReason();
  const text = reasonText(reason);
  return text ? <span className="text-muted-foreground text-xs">{text}</span> : null;
}

export function TopicNote({ topic }: { topic: SyllabusTopic }) {
  return <ReasonText reason={topic.status === "known" ? "known" : topic.notPlannedReason} />;
}
