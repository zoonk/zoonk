"use client";

import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/checkpoint-call-contract";
import { Button } from "@zoonk/ui/components/button";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { StudyTimeUsedUpActions, StudyTimeUsedUpNote } from "../../_components/study-time-used-up";
import { TaskActions } from "../../_components/task-layout";
import { ChallengeCallPlusNotice, SeePlusAction } from "../../challenge/challenge-plus-lock";
import { TaskMainButton } from "../../shell/task-frame";
import { loadLiveCallSession } from "./load-live-call-session";
import { type CallAudio, openCallAudio, openTypedCallAudio } from "./use-call-microphone";

export type CallIntroFooterState =
  | "dailyLimitReached"
  | "failed"
  | "idle"
  | "plusRequired"
  | "starting";

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
function useMicrophoneAsk(onAudio: (audio: CallAudio) => void) {
  const [ask, setAsk] = useState<"asking" | "blocked" | "idle">("idle");
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

    if (mine !== attempt.current) {
      audio?.stop();
      return;
    }

    setAsk(audio ? "idle" : "blocked");

    if (audio) {
      onAudio(audio);
    }
  };

  const typeInstead = () => {
    attempt.current += 1;
    setAsk("idle");
    onAudio(openTypedCallAudio());
  };

  return {
    asking: ask === "asking",
    blocked: ask === "blocked",
    call: () => void call(),
    prompting,
    typeInstead,
  };
}

/**
 * Its status region is mounted from the start, so a line that replaces a refused Start is read out.
 */
export function CallIntroFooter({
  conversation,
  onStart,
  start,
}: {
  conversation: Pick<LanguageConversationIntro, "character" | "examTask" | "kind">;
  onStart: (audio: CallAudio) => void;
  start: CallIntroFooterState;
}) {
  const t = useExtracted();
  const microphone = useMicrophoneAsk(onStart);
  const { name } = conversation.character;

  return (
    <>
      <div aria-atomic="true" aria-live="polite" className="empty:absolute" role="status">
        {start === "dailyLimitReached" && (
          <StudyTimeUsedUpNote>
            {t({
              description: "The daily time limit is a setting that stops study for the day.",
              message:
                "You've reached your daily time limit. You can make this call in your next session.",
            })}
          </StudyTimeUsedUpNote>
        )}

        {microphone.blocked && <MicrophoneOff name={name} />}

        {microphone.prompting && (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("Allow the microphone to talk with {name}.", { name })}
          </p>
        )}
      </div>

      {microphone.blocked && start !== "dailyLimitReached" && start !== "plusRequired" ? (
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

function MicrophoneOff({ name }: { name: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-1 pb-1">
      <p className="font-medium">{t("Your microphone is off")}</p>
      <p className="text-muted-foreground text-sm text-pretty">
        {t(
          "Allow the microphone for Zoonk in your browser settings to talk with {name}, or do this call by typing.",
          { name },
        )}
      </p>
    </div>
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

  if (start === "dailyLimitReached") {
    return <StudyTimeUsedUpActions href="/today" />;
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
        <TaskMainButton busy={starting} onClick={onStart}>
          {!starting && <PhoneIcon aria-hidden="true" />}
          {starting && t("Starting…")}
          {!starting && (isCall ? t("Call {name}", { name }) : t("Start the call"))}
        </TaskMainButton>
      </TaskActions>
    </>
  );
}
