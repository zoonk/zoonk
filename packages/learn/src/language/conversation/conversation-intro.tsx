"use client";

import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/checkpoint-call-contract";
import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { PageEyebrow, PageSectionTitle } from "../../_components/page";
import { TaskAsideContent } from "../../_components/task-layout";
import { useFormatDuration } from "../../_utils/time-format";
import { TaskFrame } from "../../shell/task-frame";
import { ChecklistRow, ChecklistRows } from "../checklist-rows";
import { ExamTaskIntro } from "../exam-speaking/exam-task-intro";
import { CallIntroFooter, type CallIntroFooterState, callsCharacter } from "./call-intro-footer";
import { useConversationTitle } from "./conversation-labels";
import { CharacterRow, MicNote } from "./conversation-parts";
import {
  type CallAudio,
  type MicrophoneProblem,
  type TappedCallAudio,
  holdCallAudio,
} from "./use-call-microphone";

type CheckpointStart = "failed" | "idle" | "plusRequired" | "starting";

type CheckpointStartResult = "cancelled" | "changed" | "failed" | "plusRequired" | "ready";

export function CheckpointCallIntro({
  conversation,
  onStart,
  rereading,
}: {
  conversation: LanguageConversationIntro;
  onStart: (audio: TappedCallAudio) => Promise<CheckpointStartResult>;
  rereading: boolean;
}) {
  const [start, setStart] = useState<CheckpointStart>("idle");
  const attempt = useRef(0);

  // Activity runs this when the screen hides too, so Start is ready when it's back.
  useEffect(
    () => () => {
      attempt.current += 1;
      setStart((current) => (current === "plusRequired" ? current : "idle"));
    },
    [],
  );

  const run = async (opened: CallAudio) => {
    const audio = holdCallAudio(opened);
    const mine = attempt.current + 1;
    attempt.current = mine;
    setStart("starting");

    const result = await onStart(audio).catch(() => "failed" as const);

    if (result !== "ready") {
      audio.release();
    }

    if (mine === attempt.current && result !== "ready") {
      setStart(result === "cancelled" || result === "changed" ? "idle" : result);
    }
  };

  return (
    <CallIntro
      conversation={conversation}
      exitHref="/today"
      footer={
        <CallIntroFooter
          conversation={conversation}
          onStart={(audio) => void run(audio)}
          start={toFooterState({ rereading, start })}
        />
      }
    />
  );
}

function toFooterState({
  rereading,
  start,
}: {
  rereading: boolean;
  start: CheckpointStart;
}): CallIntroFooterState {
  if (rereading) {
    return "starting";
  }

  return start;
}

export function ConversationIntro({
  conversation,
  exitHref,
  locked = false,
  microphoneProblem = null,
  onStart,
}: {
  conversation: LanguageConversationView;
  exitHref: string;
  locked?: boolean;
  microphoneProblem?: MicrophoneProblem | null;
  onStart: (audio: CallAudio) => void;
}) {
  const { examTask } = conversation;

  const footer = (
    <CallIntroFooter
      conversation={conversation}
      microphoneProblem={microphoneProblem}
      onStart={onStart}
      start={locked ? "plusRequired" : "idle"}
    />
  );

  return examTask ? (
    <ExamTaskIntro
      conversation={conversation}
      examTask={examTask}
      exitHref={exitHref}
      footer={footer}
    />
  ) : (
    <CallIntro conversation={conversation} exitHref={exitHref} footer={footer} />
  );
}

function HowTheCallWorks({ conversation }: { conversation: LanguageConversationIntro }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const titleId = useId();
  const { name } = conversation.character;
  const time = formatDuration(conversation.minutes);

  const steps = [
    t("{name} answers and speaks first.", { name }),
    t("Then it's your turn: answer out loud, or type if you can't talk."),
    t(
      "When you've done everything, or after about {time}, {name} says goodbye and the call ends.",
      { name, time },
    ),
  ];

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <PageSectionTitle id={titleId}>{t("How the call works")}</PageSectionTitle>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li className="flex gap-3 text-[0.9375rem] leading-snug text-pretty" key={step}>
            <span
              aria-hidden="true"
              className="text-muted-foreground w-3 shrink-0 font-mono text-[0.8125rem] leading-5.5 tabular-nums"
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CallIntro({
  conversation,
  exitHref,
  footer,
}: {
  conversation: LanguageConversationIntro;
  exitHref: string;
  footer: ReactNode;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const eyebrow = useConversationTitle(conversation);
  const { character } = conversation;
  const time = formatDuration(conversation.minutes);
  const isCall = callsCharacter(conversation);

  return (
    <TaskFrame
      aside={{ label: t("What to get across"), title: t("What to get across") }}
      closeOnEscape
      exitHref={exitHref}
      footer={footer}
      headerTitle={eyebrow}
    >
      <header className="flex flex-col gap-2">
        <PageEyebrow>
          {t("About {time} · Level {level}", { level: conversation.level, time })}
        </PageEyebrow>
        <h1 className="text-title text-balance">{conversation.title}</h1>
        <p className="text-muted-foreground text-pretty">{conversation.situation}</p>
        {!isCall && (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("It ends on its own after about {time}.", { time })}
          </p>
        )}
      </header>

      <CharacterRow
        detail={t("{role} · {place}", { place: character.place, role: character.role })}
        name={character.name}
      />

      {isCall && <HowTheCallWorks conversation={conversation} />}

      <TaskAsideContent
        aria-labelledby="call-goals"
        className="flex w-full flex-col gap-1"
        role="region"
      >
        <PageSectionTitle className="lg:sr-only" id="call-goals">
          {t("What to get across")}
        </PageSectionTitle>
        <ChecklistRows>
          {conversation.objectives.map((objective) => (
            <ChecklistRow
              description={objective.description}
              done={false}
              key={objective.label}
              lang={conversation.targetLanguage}
            >
              {objective.label}
            </ChecklistRow>
          ))}
        </ChecklistRows>
      </TaskAsideContent>

      <MicNote>{t("Turn your sound on. The microphone is on only during the call.")}</MicNote>
    </TaskFrame>
  );
}
