"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { CircleIcon, ClockIcon, MicIcon, PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";
import { CharacterAvatar } from "./conversation-parts";

/**
 * Before the call, as one card: who the learner talks to and how long it lasts, then why and what
 * to get across; by the button, that they can speak or type and the microphone is only used
 * during the call. One button (or Enter) starts it; Escape leaves, since nothing has started.
 */
export function ConversationIntro({
  conversation,
  exitHref,
  onStart,
}: {
  conversation: LanguageConversationView;
  exitHref: string;
  onStart: () => void;
}) {
  const t = useExtracted();
  const eyebrow = useConversationTitle(conversation);
  const { character } = conversation;

  return (
    <TaskFrame
      closeOnEscape
      exitHref={exitHref}
      footer={
        <>
          {/* The icon flows with the centered text, so it stays on the first line when it wraps. */}
          <p className="text-muted-foreground text-center text-xs text-balance">
            <MicIcon aria-hidden="true" className="me-1.5 inline size-3.5 align-[-0.2em]" />
            {t("Speak or type. The microphone is used only during the call.")}
          </p>
          <TaskMainButton onClick={onStart}>
            <PhoneIcon aria-hidden="true" />
            {t("Start the call")}
          </TaskMainButton>
        </>
      }
      headerTitle={eyebrow}
    >
      <section className="bg-card flex flex-col items-center gap-4 rounded-3xl border px-6 py-8 text-center shadow-xs sm:px-8">
        <CharacterAvatar name={character.name} size="lg" />
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-balance">{conversation.title}</h1>
          <p className="text-muted-foreground text-balance">
            {t("{name} · {role} · {place}", {
              name: character.name,
              place: character.place,
              role: character.role,
            })}
          </p>
        </div>
        <FactChips className="justify-center">
          <FactChip>
            <ClockIcon aria-hidden="true" />
            {t("{minutes} min", { minutes: String(conversation.minutes) })}
          </FactChip>
        </FactChips>
      </section>

      <p className="text-muted-foreground text-pretty">{conversation.situation}</p>

      <section
        aria-labelledby="call-goals"
        className="bg-muted/60 flex flex-col gap-3 rounded-2xl p-4"
      >
        <h2 className="text-sm font-medium" id="call-goals">
          {t("What to get across")}
        </h2>
        <ul className="flex flex-col gap-3">
          {conversation.objectives.map((objective) => (
            <li className="flex items-start gap-2.5" key={objective.label}>
              <CircleIcon
                aria-hidden="true"
                className="text-muted-foreground mt-1 size-4 shrink-0"
              />
              <span className="flex flex-col">
                <span lang={conversation.targetLanguage}>{objective.label}</span>
                <span className="text-muted-foreground text-sm">{objective.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </TaskFrame>
  );
}
