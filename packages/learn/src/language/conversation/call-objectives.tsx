"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { SectionLabel } from "../../_components/section-label";
import { ChecklistRow, ChecklistRows } from "../checklist-rows";
import { SpeakingCard } from "../exam-speaking/speaking-card";

/** How many of the call's goals are across, for the "1/3" beside their name. */
export function countMetGoals(conversation: LanguageConversationView, met: string[]): number {
  return conversation.objectives.filter((objective) => met.includes(objective.label)).length;
}

/**
 * What the learner works toward during the call: the goals as a checklist, each turning to a green
 * dot as it's met, with how many are across ("1/3"). An exam task shows its card instead, as the
 * sheet stays on the table through the exam; its one goal is the task itself, graded once it ends.
 * In the aside from `lg`, the aside's own header names them (`titled={false}`).
 */
export function CallObjectives({
  conversation,
  met,
  titled = true,
}: {
  conversation: LanguageConversationView;
  met: string[];
  titled?: boolean;
}) {
  const t = useExtracted();
  const titleId = useId();
  const { objectives } = conversation;

  if (conversation.examTask) {
    return (
      <SpeakingCard
        card={conversation.examTask.card}
        compact
        language={conversation.targetLanguage}
      />
    );
  }

  const done = countMetGoals(conversation, met);

  return (
    <section
      aria-label={titled ? undefined : t("Goals of the call")}
      aria-labelledby={titled ? titleId : undefined}
      className="flex flex-col gap-1"
    >
      {titled && (
        <div className="flex items-center justify-between gap-3">
          <SectionLabel id={titleId}>{t("Goals of the call")}</SectionLabel>
          <span
            aria-hidden="true"
            className="text-muted-foreground font-mono text-xs tabular-nums"
          >{`${done}/${objectives.length}`}</span>
        </div>
      )}
      <ChecklistRows>
        {objectives.map((objective) => (
          <ChecklistRow
            className="py-2"
            done={met.includes(objective.label)}
            key={objective.label}
            lang={conversation.targetLanguage}
          >
            {objective.label}
          </ChecklistRow>
        ))}
      </ChecklistRows>
    </section>
  );
}
