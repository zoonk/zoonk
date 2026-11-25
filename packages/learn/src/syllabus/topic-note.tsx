"use client";

import {
  type NotPlannedReason,
  type SyllabusTopic,
} from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";

/** `isModule`: the plan isn't for an exam, so it calls what the learner took out a module. */
export function useNotPlannedReason({ isModule }: { isModule: boolean }) {
  const t = useExtracted();

  return function reasonText(reason: NotPlannedReason | null): string | null {
    if (reason === null) {
      return null;
    }

    switch (reason) {
      case "skipped":
        return isModule
          ? t({
              description:
                "Why a module or a step on the path isn't in the learner's plan: they took the module out. Said on a plan that isn't for an exam, whose list is titled \"Modules\".",
              message: "Not in your plan · you took this module out",
            })
          : t({
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
            "Why a topic, subject or step on the path isn't in the learner's plan: their study time goes to other topics first. Starts with the same words as \"Not in your plan · you took this subject out\".",
          message: "Not in your plan · other topics come first",
        });
      case "missing":
        return t({
          description: "On a topic's row in the plan: its lessons aren't ready yet.",
          id: "topicNotReady",
          message: "Not ready yet",
        });
      default:
        return null;
    }
  };
}

export function ReasonText({
  isModule,
  reason,
}: {
  isModule: boolean;
  reason: NotPlannedReason | null;
}) {
  const reasonText = useNotPlannedReason({ isModule });
  const text = reasonText(reason);
  return text ? <span className="text-muted-foreground text-xs">{text}</span> : null;
}

/** Only an exam's subjects list topics. */
export function TopicNote({ topic }: { topic: SyllabusTopic }) {
  return (
    <ReasonText
      isModule={false}
      reason={topic.status === "known" ? "known" : topic.notPlannedReason}
    />
  );
}
