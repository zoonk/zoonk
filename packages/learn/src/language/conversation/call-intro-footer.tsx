"use client";

import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/checkpoint-call-contract";
import { Button } from "@zoonk/ui/components/button";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { StatusRegion } from "../../_components/status-region";
import { TaskActions } from "../../_components/task-layout";
import { ChallengeCallPlusNotice, SeePlusAction } from "../../challenge/challenge-plus-lock";
import { TaskMainButton } from "../../shell/task-frame";
import { CallReason } from "./conversation-parts";
import { loadLiveCallSession } from "./load-live-call-session";
import {
  type CallAudio,
  type MicrophoneProblem,
  openCallAudio,
  openTypedCallAudio,
} from "./use-call-microphone";

export type CallIntroFooterState = "failed" | "idle" | "plusRequired" | "starting";

/** Long enough for a microphone already allowed to answer without a prompt. */
const PROMPT_SHOWN_MS = 300;

/** An examiner isn't someone the learner calls, so exams keep "Start the call". */
export function callsCharacter(conversation: Pick<LanguageConversationIntro, "examTask" | "kind">) {
  return !conversation.examTask && conversation.kind !== "speakingMock";
}

function preloadLiveCall() {
  void loadLiveCallSession();
}

/**
 * The tap asks for the microphone before anything is reserved: Safari on iOS asks only during a
 * tap, and a call the learner can't speak in shouldn't start on its own.
 */
function useMicrophoneAsk({
  onAudio,
  problem,
}: {
  onAudio: (audio: CallAudio) => void;
  problem: MicrophoneProblem | null;
}) {
  const [ask, setAsk] = useState<"asking" | "idle" | MicrophoneProblem>(problem ?? "idle");
  const attempt = useRef(0);
  const prompting = useTakingLong({ active: ask === "asking", afterMs: PROMPT_SHOWN_MS });

  // Activity runs this when the screen hides too: a prompt answered meanwhile starts nothing.
  useEffect(
    () => () => {
      attempt.current += 1;
      setAsk("idle");
    },
    [],
  );

  const call = async () => {
    const mine = attempt.current + 1;
    attempt.current = mine;
    setAsk("asking");
    const audio = await openCallAudio();
    const current = mine === attempt.current;

    if (typeof audio === "string") {
      if (current) {
        setAsk(audio);
      }

      return;
    }

    if (!current) {
      audio.stop();
      return;
    }

    setAsk("idle");
    onAudio(audio);
  };

  const typeInstead = () => {
    attempt.current += 1;
    setAsk("idle");
    onAudio(openTypedCallAudio());
  };

  return {
    asking: ask === "asking",
    call: () => void call(),
    problem: ask === "asking" || ask === "idle" ? null : ask,
    prompting,
    typeInstead,
  };
}

/**
 * Its status region is mounted from the start, so a line that replaces a refused Start is read out.
 */
export function CallIntroFooter({
  conversation,
  microphoneProblem = null,
  onStart,
  start,
}: {
  conversation: Pick<LanguageConversationIntro, "character" | "examTask" | "kind">;
  microphoneProblem?: MicrophoneProblem | null;
  onStart: (audio: CallAudio) => void;
  start: CallIntroFooterState;
}) {
  const t = useExtracted();
  const microphone = useMicrophoneAsk({ onAudio: onStart, problem: microphoneProblem });
  const { name } = conversation.character;
  const status = useRef<HTMLDivElement>(null);

  // The message replaces the button the learner pressed: keep their place there, not at the top.
  useEffect(() => {
    if (microphone.problem && document.activeElement === document.body) {
      status.current?.focus();
    }
  }, [microphone.problem]);

  return (
    <>
      <StatusRegion className="outline-none" ref={status} tabIndex={-1}>
        {microphone.problem && <MicrophoneOff name={name} problem={microphone.problem} />}

        {microphone.prompting && (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("Allow the microphone to talk with {name}.", { name })}
          </p>
        )}
      </StatusRegion>

      {microphone.problem && start !== "plusRequired" ? (
        <TaskActions>
          <Button
            className="shrink-0"
            onClick={microphone.call}
            size="lg"
            type="button"
            variant="outline"
          >
            {t("Try again")}
          </Button>
          <TaskMainButton onClick={microphone.typeInstead}>{t("Type instead")}</TaskMainButton>
        </TaskActions>
      ) : (
        <CallIntroActions
          callsCharacter={callsCharacter(conversation)}
          name={name}
          onStart={microphone.call}
          start={microphone.asking ? "starting" : start}
        />
      )}
    </>
  );
}

export function MicrophoneOff({ name, problem }: { name: string; problem: MicrophoneProblem }) {
  const t = useExtracted();
  const unavailable = problem === "unavailable";

  return (
    <CallReason
      className="pb-1"
      title={unavailable ? t("We can't use your microphone") : t("Your microphone is off")}
    >
      <p className="text-muted-foreground text-sm text-pretty">
        {unavailable
          ? t(
              "Check that a microphone is connected and no other app is using it, or do this call by typing.",
            )
          : t(
              "Allow the microphone for Zoonk in your browser settings to talk with {name}, or do this call by typing.",
              { name },
            )}
      </p>
    </CallReason>
  );
}

function CallIntroActions({
  callsCharacter: isCall,
  name,
  onStart,
  start,
}: {
  callsCharacter: boolean;
  name: string;
  onStart: () => void;
  start: CallIntroFooterState;
}) {
  const t = useExtracted();

  if (start === "plusRequired") {
    return (
      <>
        <ChallengeCallPlusNotice />
        <SeePlusAction />
      </>
    );
  }

  const starting = start === "starting";

  return (
    <>
      {start === "failed" && (
        <p className="text-destructive-text text-sm text-pretty" role="alert">
          {t("The call didn't start. Try again in a moment.")}
        </p>
      )}

      <TaskActions
        onFocus={preloadLiveCall}
        onPointerDown={preloadLiveCall}
        onPointerEnter={preloadLiveCall}
      >
        <TaskMainButton busy={starting} icon={<PhoneIcon aria-hidden="true" />} onClick={onStart}>
          {isCall ? t("Call {name}", { name }) : t("Start the call")}
        </TaskMainButton>
      </TaskActions>
    </>
  );
}
