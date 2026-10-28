"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { PageSectionTitle } from "../../_components/page";
import { ChecklistRow, ChecklistRows } from "../checklist-rows";
import { SpeakingCard } from "../exam-speaking/speaking-card";

export function countMetGoals(conversation: LanguageConversationView, met: string[]): number {
  return conversation.objectives.filter((objective) => met.includes(objective.label)).length;
}

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
          <PageSectionTitle id={titleId}>{t("Goals of the call")}</PageSectionTitle>
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
