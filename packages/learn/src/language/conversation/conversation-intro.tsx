"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { CircleIcon, MicIcon, PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useExperienceMode } from "../../mode-provider";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";
import { CharacterAvatar } from "./conversation-parts";

/**
 * Before the call: who the learner talks to, what they want from the call, how long it lasts and
 * that the microphone is only used during it. One button starts it; Fun calls it a boss when it
 * closes a unit.
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
  const mode = useExperienceMode();
  const eyebrow = useConversationTitle(conversation);
  const { character } = conversation;

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={
        <>
          {/* The icon flows with the centered text, so it stays on the first line when it wraps. */}
          <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-center text-xs text-balance">
            <MicIcon aria-hidden="true" className="me-1.5 inline size-3.5 align-[-0.2em]" />
            {t("The microphone is used only during the call. Recordings aren't kept.")}
          </p>
          <TaskMainButton onClick={onStart}>
            <PhoneIcon aria-hidden="true" />
            {mode === "fun" ? t("Call {name}", { name: character.name }) : t("Start the call")}
          </TaskMainButton>
        </>
      }
      headerTitle={eyebrow}
    >
      <div className="in-data-[mode=fun]:fun-glass flex flex-col items-center gap-3 rounded-3xl py-6 text-center">
        <CharacterAvatar name={character.name} size="lg" />
        <div className="flex flex-col gap-0.5">
          <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold tracking-tight">
            {character.name}
          </h1>
          <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
            {t("{role} · {place}", { place: character.place, role: character.role })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-balance">{conversation.title}</h2>
        <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2">
          {conversation.situation}
        </p>
      </div>

      <section aria-labelledby="call-goals" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium" id="call-goals">
          {t("What to get across")}
        </h2>
        <ul className="flex flex-col gap-2">
          {conversation.objectives.map((objective) => (
            <li className="flex items-start gap-2" key={objective.label}>
              <CircleIcon
                aria-hidden="true"
                className="text-muted-foreground mt-1 size-4 shrink-0"
              />
              <span className="flex flex-col">
                <span lang={conversation.targetLanguage}>{objective.label}</span>
                <span className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
                  {objective.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
        {t(
          "{minutes, plural, one {About # minute.} other {About # minutes.}} Speak or type. Mistakes are fine: feedback comes after the call.",
          { minutes: conversation.minutes },
        )}
      </p>
    </TaskFrame>
  );
}
