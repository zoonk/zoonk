"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import {
  KeyboardIcon,
  LifeBuoyIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../../_utils/locale";
import { SavingLine } from "./call-problem";
import { CharacterAvatar } from "./conversation-parts";
import { type LiveCall } from "./use-live-call";

const MARK_CLASS = "grid size-8 shrink-0 place-items-center rounded-full [&>svg]:size-4";

function CallingMark() {
  return (
    <span aria-hidden="true" className={cn(MARK_CLASS, "bg-secondary relative")}>
      <PhoneIcon />
      <span className="border-foreground/15 border-t-foreground/60 absolute inset-0 animate-spin rounded-full border-[1.5px] motion-reduce:animate-none" />
    </span>
  );
}

function MicMark({ listening }: { listening: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        MARK_CLASS,
        "bg-primary text-primary-foreground ring-offset-background ring-[1.5px] ring-transparent ring-offset-2 transition-shadow duration-150 motion-reduce:transition-none",
        listening && "ring-foreground/40",
      )}
    >
      <MicIcon />
    </span>
  );
}

function QuietMark({ icon }: { icon: React.ReactNode }) {
  return (
    <span aria-hidden="true" className={cn(MARK_CLASS, "bg-secondary text-secondary-foreground")}>
      {icon}
    </span>
  );
}

function useWrapUpLine({ call, name }: { call: LiveCall; name: string }) {
  const t = useExtracted();
  const reason = call.turn?.saidGoodbye ? null : call.turn?.reason;

  if (reason === "done") {
    return t("All goals done. {name} will wrap up after your answer.", { name });
  }

  if (reason !== "time") {
    return null;
  }

  return t("Almost time. {name} will say goodbye after your answer.", { name });
}

type TurnState = { detail: string | null; mark: React.ReactNode; title: string };

function useYourTurnDetail({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}) {
  const t = useExtracted();
  const { name } = conversation.character;

  const next = conversation.examTask
    ? undefined
    : conversation.objectives.find((objective) => !call.metLabels.includes(objective.label));

  if (call.turn?.quietHint) {
    return t("Take your time.");
  }

  if (!call.turn?.spokeOutLoud && !call.micBlocked) {
    return t("Answer {name} out loud.", { name });
  }

  return next ? t("Tip: {goal}", { goal: next.description }) : null;
}

function useTurnState({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}): TurnState {
  const t = useExtracted();
  const { name } = conversation.character;
  const yourTurn = useYourTurnDetail({ call, conversation });
  const { turn } = call;

  if (call.reconnecting && call.phase !== "live") {
    return { detail: null, mark: <CallingMark />, title: t("Reconnecting…") };
  }

  if (!turn?.greeted) {
    return {
      detail: t("{name} answers first.", { name }),
      mark: <CallingMark />,
      title: t("Calling {name}…", { name }),
    };
  }

  if (turn.saidGoodbye) {
    return {
      detail: null,
      mark: <CharacterAvatar name={name} talking />,
      title: t("{name} is saying goodbye", { name }),
    };
  }

  if (turn.characterSpeaking) {
    const firstTurn = !call.turns.some((item) => item.speaker === "learner");

    return {
      detail: firstTurn ? t("Listen, then answer.") : null,
      mark: <CharacterAvatar name={name} talking />,
      title: t("{name} is talking", { name }),
    };
  }

  if (call.muted) {
    return {
      detail: t("Unmute to answer out loud, or type your reply."),
      mark: <QuietMark icon={<MicOffIcon />} />,
      title: t("Muted"),
    };
  }

  if (call.micBlocked) {
    return {
      detail: t("Type your reply below."),
      mark: <QuietMark icon={<KeyboardIcon />} />,
      title: t("Your turn"),
    };
  }

  if (turn.learnerSpeaking) {
    return {
      detail: null,
      mark: <MicMark listening />,
      title: t({
        description: "Call status while Zoonk hears the learner speak.",
        message: "Listening…",
      }),
    };
  }

  return { detail: yourTurn, mark: <MicMark listening={false} />, title: t("Your turn") };
}

/** Plain text, read on demand: its flips are audible in the call already. */
export function CallTurn({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}) {
  const state = useTurnState({ call, conversation });
  const wrapUp = useWrapUpLine({ call, name: conversation.character.name });
  const detail = wrapUp ?? state.detail;

  return (
    <div className="flex min-h-11 items-center gap-3" data-slot="call-turn">
      {state.mark}
      <p className="flex min-w-0 flex-col text-pretty">
        <span className="text-sm leading-5 font-medium">{state.title}</span>
        {detail && (
          <span className="text-muted-foreground text-[0.8125rem] leading-snug">{detail}</span>
        )}
      </p>
    </div>
  );
}

/**
 * The one live region of the call: the wrap-up line, mute, reconnecting and the end. The
 * transcript isn't live, so a screen reader doesn't talk over the character into the microphone.
 */
export function CallAnnouncer({
  call,
  ended,
  grading,
  name,
}: {
  call: LiveCall;
  ended: boolean;
  grading: boolean;
  name: string;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();
  const wrapUp = useWrapUpLine({ call, name });

  const announcement = (() => {
    if (ended) {
      return (
        <>
          {t("Call ended")}
          {space}
          <SavingLine grading={grading} />
        </>
      );
    }

    if (call.reconnecting && call.phase !== "live") {
      return t("Reconnecting…");
    }

    return call.muted ? t("Muted") : wrapUp;
  })();

  return (
    <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
      {announcement}
    </p>
  );
}

export function CallControls({
  call,
  onEnd,
  onHelp,
}: {
  call: LiveCall;
  onEnd: () => void;
  onHelp: () => void;
}) {
  const t = useExtracted();
  const isOff = call.micBlocked || call.muted;
  const canMute = call.phase === "live" && !call.micBlocked;

  return (
    <div className="flex gap-2 *:min-w-0 *:flex-1">
      <Button onClick={onHelp} size="lg" type="button" variant="outline">
        <LifeBuoyIcon aria-hidden="true" />
        {t("Help")}
      </Button>
      <Button
        aria-pressed={call.muted}
        className={cn(call.muted && "bg-secondary")}
        disabled={!canMute}
        onClick={call.toggleMute}
        size="lg"
        type="button"
        variant="outline"
      >
        {isOff ? <MicOffIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
        {t("Mute")}
      </Button>
      {/* Hovered, it tints red: on the outline's gray, the red label would lose its contrast. */}
      <Button
        className="text-destructive-text hover:bg-destructive/10 hover:text-destructive-text"
        onClick={onEnd}
        size="lg"
        type="button"
        variant="outline"
      >
        <PhoneOffIcon aria-hidden="true" />
        {call.phase === "live" ? t("End") : t("Cancel")}
      </Button>
    </div>
  );
}
