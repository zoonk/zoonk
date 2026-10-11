"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SpeakingCard } from "../exam-speaking/speaking-card";

/**
 * What the learner works toward during the call: the goals as chips, checked as they're met. An
 * exam task shows its card instead, as the sheet stays on the table through the exam; its one goal
 * is the task itself, graded once it ends.
 */
export function CallObjectives({
  conversation,
  met,
}: {
  conversation: LanguageConversationView;
  met: string[];
}) {
  const t = useExtracted();

  if (conversation.examTask) {
    return (
      <SpeakingCard
        card={conversation.examTask.card}
        compact
        language={conversation.targetLanguage}
      />
    );
  }

  return (
    <ul aria-label={t("Goals of the call")} className="flex flex-wrap justify-center gap-2">
      {conversation.objectives.map((objective) => {
        const done = met.includes(objective.label);

        return (
          <li
            className={cn(
              "flex items-start gap-1.5 rounded-2xl border px-3 py-1 text-xs",
              done && "border-success text-success",
            )}
            key={objective.label}
            lang={conversation.targetLanguage}
          >
            {/* A long goal wraps inside the chip with its mark on the first line. */}
            <LineMarker>
              {done ? (
                <CircleCheckIcon aria-hidden="true" className="size-3.5" />
              ) : (
                <CircleIcon aria-hidden="true" className="size-3.5" />
              )}
            </LineMarker>
            {objective.label}
            <span className="sr-only">{done ? t("done") : t("not yet")}</span>
          </li>
        );
      })}
    </ul>
  );
}
