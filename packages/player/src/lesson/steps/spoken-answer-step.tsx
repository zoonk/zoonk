"use client";

import { useNoSpeechMessage } from "@zoonk/learn/language/no-speech";
import { Button } from "@zoonk/ui/components/button";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { cn } from "@zoonk/ui/lib/utils";
import { HeadphonesIcon, KeyboardIcon, MicIcon, SquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { InteractiveStepLayout } from "../../components/step-layouts";
import { LessonHelpLimitNotice } from "../_components/help-limit-notice";
import { LessonQuestion } from "../_components/lesson-step-text";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { CHECK_BOUNDS } from "../use-step-grading";
import { ExerciseStepView } from "./exercise-step";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";
import { useCantTalkNow } from "./use-cant-talk-now";

const MS_PER_SECOND = 1000;

function TargetText({ step }: { step: StepOf<"spokenAnswer"> }) {
  const { romanization, targetText, translation } = step.content;

  return (
    <div className="bg-muted/50 flex flex-col gap-1 rounded-2xl p-4">
      <p className="text-2xl font-semibold tracking-tight sm:text-3xl" lang={step.content.language}>
        {targetText}
      </p>
      {romanization && <p className="text-muted-foreground text-base">{romanization}</p>}
      {translation && <p className="text-muted-foreground text-base">{translation}</p>}
    </div>
  );
}

/** The microphone button. `onBlocked` hears when the browser or the learner blocks the microphone. */
function RecordButton({ onBlocked, stepId }: { onBlocked: () => void; stepId: string }) {
  const t = useExtracted();
  const { actions, state } = useLessonPlayer();

  const onRecorded = useCallback(
    ({ audio, durationMs }: { audio: Blob; durationMs: number }) =>
      actions.submitSpokenAnswer({ audio, durationMs, stepId }),
    [actions, stepId],
  );

  const recorder = useVoiceRecorder({ onRecorded });
  const isRecording = recorder.status === "recording";
  const seconds = Math.floor(recorder.elapsedMs / MS_PER_SECOND);

  const startRecording = async () => {
    if (!(await recorder.start())) {
      onBlocked();
    }
  };

  const isSlow = useTakingLong({
    active: state.phase === "checking",
    afterMs: CHECK_BOUNDS.slowMs,
  });

  const noSpeech = useNoSpeechMessage();
  const issue = recorder.status === "idle" ? state.checkIssue : null;
  const limit = issue?.status === "noSpeech" ? null : issue;

  function getIdleHint() {
    if (issue?.status === "noSpeech") {
      return noSpeech;
    }

    if (state.checkFailed) {
      return t("We couldn't check your answer this time. Try again.");
    }

    return isSlow
      ? t("Still checking. This is taking longer than usual.")
      : t("Tap and say it out loud");
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        aria-pressed={isRecording}
        className={cn("size-20 rounded-full", isRecording && "motion-safe:animate-pulse")}
        onClick={isRecording ? recorder.stop : () => void startRecording()}
        size="icon-lg"
        variant={isRecording ? "destructive" : "default"}
      >
        {isRecording ? (
          <SquareIcon aria-hidden="true" className="size-7" />
        ) : (
          <MicIcon aria-hidden="true" className="size-8" />
        )}
        <span className="sr-only">{isRecording ? t("Stop and check") : t("Start speaking")}</span>
      </Button>

      <div aria-live="polite" className="flex flex-col items-center">
        {limit ? (
          <LessonHelpLimitNotice className="items-center text-center" limit={limit} />
        ) : (
          <p
            className={cn(
              "text-muted-foreground text-center text-sm",
              state.checkFailed && recorder.status === "idle" && "text-destructive",
            )}
          >
            {recorder.status === "idle" && getIdleHint()}
            {isRecording && t("Listening… {seconds}s. Tap to stop.", { seconds: String(seconds) })}
          </p>
        )}
      </div>
    </div>
  );
}

type AnswerMode = "listen" | "speak" | "type";

function getAnswerMode({
  canListen,
  canSpeak,
  cantTalk,
  micBlocked,
  prefersTyping,
}: {
  canListen: boolean;
  canSpeak: boolean;
  cantTalk: boolean;
  micBlocked: boolean;
  prefersTyping: boolean;
}): AnswerMode {
  if ((cantTalk || !canSpeak) && canListen) {
    return "listen";
  }

  return prefersTyping || micBlocked || !canSpeak ? "type" : "speak";
}

/**
 * How the learner answers now. Speaking is the default; "I can't talk now" plays the sentence as
 * listening when the screen has it, for the rest of the visit; typing covers a quiet room without
 * a listening version, a browser that can't record, and a microphone blocked when they tap to
 * speak, which brings up the typing field right away with a line saying why.
 */
function useAnswerMode({
  onAnswer,
  step,
}: Pick<LessonStepViewProps<StepOf<"spokenAnswer">>, "onAnswer" | "step">) {
  const { adapters } = useLessonPlayerConfig();
  const canRecord = useCanRecord();
  const canSpeak = Boolean(adapters.gradeSpokenAnswer) && canRecord;
  const canListen = step.listening !== null;
  const [cantTalk, setCantTalk] = useCantTalkNow();
  const [prefersTyping, setPrefersTyping] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);

  const mode = getAnswerMode({ canListen, canSpeak, cantTalk, micBlocked, prefersTyping });

  /** An answer started one way doesn't carry over to another; asking to speak tries the mic again. */
  const switchTo = (next: { cantTalk: boolean; prefersTyping: boolean }) => {
    onAnswer(null);
    setCantTalk(next.cantTalk);
    setPrefersTyping(next.prefersTyping);
    setMicBlocked(false);
  };

  return { canListen, canSpeak, micBlocked, mode, onBlocked: () => setMicBlocked(true), switchTo };
}

/** "I can't talk now": the same sentence as a listening exercise, heard and built from a word bank. */
function ListeningInstead({
  props,
  step,
}: {
  props: LessonStepViewProps<StepOf<"spokenAnswer">>;
  step: StepOf<"spokenAnswer"> & { listening: NonNullable<StepOf<"spokenAnswer">["listening"]> };
}) {
  return (
    <ExerciseStepView
      {...props}
      step={{
        exercise: step.listening,
        id: step.id,
        kind: "listening",
        position: step.position,
        skillId: step.skillId,
        wordHints: null,
      }}
    />
  );
}

function ModeSwitch({
  answerMode,
  isLocked,
}: {
  answerMode: ReturnType<typeof useAnswerMode>;
  isLocked: boolean;
}) {
  const t = useExtracted();
  const { canListen, canSpeak, mode, switchTo } = answerMode;

  if (isLocked || !canSpeak) {
    return null;
  }

  if (mode === "listen") {
    return (
      <Button
        className="w-fit self-center"
        onClick={() => switchTo({ cantTalk: false, prefersTyping: false })}
        size="sm"
        variant="ghost"
      >
        <MicIcon aria-hidden="true" />
        {t("I can talk now")}
      </Button>
    );
  }

  if (canListen && mode === "speak") {
    return (
      <Button
        className="w-fit self-center"
        onClick={() => switchTo({ cantTalk: true, prefersTyping: false })}
        size="sm"
        variant="ghost"
      >
        <HeadphonesIcon aria-hidden="true" />
        {t("I can't talk now")}
      </Button>
    );
  }

  return (
    <Button
      className="w-fit self-center"
      onClick={() => switchTo({ cantTalk: false, prefersTyping: mode === "speak" })}
      size="sm"
      variant="ghost"
    >
      {mode === "type" ? <MicIcon aria-hidden="true" /> : <KeyboardIcon aria-hidden="true" />}
      {mode === "type" ? t("Say it instead") : t("Type it instead")}
    </Button>
  );
}

/**
 * "Say it out loud": the learner records the sentence and the grader says how each word came out.
 * When they can't talk now, the screen plays as listening instead (hear the sentence and build
 * it), or as typing when there's no listening version.
 */
export function SpokenAnswerStepView(props: LessonStepViewProps<StepOf<"spokenAnswer">>) {
  const t = useExtracted();
  const { answer, isLocked, onAnswer, step } = props;
  const answerMode = useAnswerMode({ onAnswer, step });
  const { listening } = step;
  const text = answer?.kind === "spokenAnswer" ? answer.text : "";

  if (answerMode.mode === "listen" && listening) {
    return (
      <div className="flex flex-col gap-4">
        <ListeningInstead props={props} step={{ ...step, listening }} />
        <ModeSwitch answerMode={answerMode} isLocked={isLocked} />
      </div>
    );
  }

  return (
    <InteractiveStepLayout>
      <LessonQuestion>{step.content.prompt}</LessonQuestion>
      <TargetText step={step} />

      {answerMode.mode === "type" ? (
        <>
          {answerMode.micBlocked && !isLocked && (
            <p className="text-muted-foreground text-center text-sm" role="status">
              {t("The microphone is blocked. Type your answer instead.")}
            </p>
          )}

          <LessonAnswerField
            isLocked={isLocked}
            label={step.content.prompt}
            onChange={(value) => onAnswer(value ? { kind: "spokenAnswer", text: value } : null)}
            value={text}
          />
        </>
      ) : (
        !isLocked && <RecordButton onBlocked={answerMode.onBlocked} stepId={step.id} />
      )}

      <ModeSwitch answerMode={answerMode} isLocked={isLocked} />
    </InteractiveStepLayout>
  );
}
