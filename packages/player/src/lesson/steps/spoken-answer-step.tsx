"use client";

import { useNoSpeechMessage } from "@zoonk/learn/language/no-speech";
import { Button } from "@zoonk/ui/components/button";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { cn } from "@zoonk/ui/lib/utils";
import { HeadphonesIcon, KeyboardIcon, MicIcon, SquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { COLUMN_GHOST_ACTION_CLASS, InteractiveStepLayout } from "../../components/step-layouts";
import { LessonHelpLimitNotice } from "../_components/help-limit-notice";
import { LessonQuestion } from "../_components/lesson-step-text";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { CHECK_BOUNDS } from "../use-step-grading";
import { CANT_TALK_TODAY, useTodayChoice } from "../use-today-choice";
import { ExerciseStepView } from "./exercise-step";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** A recording's length the way a timer shows it: 0:07, 1:12. */
function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** The sentence to say, on the page under the prompt, with its reading and meaning under it. */
function TargetText({ step }: { step: StepOf<"spokenAnswer"> }) {
  const { romanization, targetText, translation } = step.content;
  // A lesson in the learner's own language has nothing to translate.
  const showsTranslation = translation && translation.trim() !== targetText.trim();

  return (
    <div className="flex flex-col gap-1">
      <p
        className="text-2xl leading-tight font-[560] tracking-[-0.02em]"
        lang={step.content.language}
      >
        {targetText}
      </p>
      {romanization && <p className="text-muted-foreground text-sm">{romanization}</p>}
      {showsTranslation && <p className="text-muted-foreground text-sm">{translation}</p>}
    </div>
  );
}

/**
 * "Record", an outline button like every other in the lesson; while recording it gets a firm ring
 * and counts the seconds, and a tap stops and checks. `onBlocked` hears when the browser or the
 * learner blocks the microphone.
 */
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
    if ((await recorder.start()) === false) {
      onBlocked();
    }
  };

  const isSlow = useTakingLong({
    active: state.phase === "checking",
    afterMs: CHECK_BOUNDS.slowMs,
  });

  const noSpeech = useNoSpeechMessage();
  // While the microphone opens, Record waits and the line under it stays, so nothing jumps.
  const isIdle = recorder.status === "idle" || recorder.status === "acquiring";
  const issue = isIdle ? state.checkIssue : null;
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
    <div className="flex flex-col items-start gap-2">
      <Button
        aria-pressed={isRecording}
        className={cn(isRecording && "border-foreground ring-foreground ring-[0.5px]")}
        disabled={recorder.status === "acquiring"}
        focusableWhenDisabled
        onClick={isRecording ? recorder.stop : () => void startRecording()}
        size="lg"
        variant="outline"
      >
        {isRecording ? <SquareIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
        {isRecording ? t("Stop") : t("Record")}
        {isRecording && (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatSeconds(seconds)}
          </span>
        )}
      </Button>

      <div aria-live="polite" className="flex flex-col">
        {limit ? (
          <LessonHelpLimitNotice limit={limit} />
        ) : (
          <p
            className={cn(
              "text-muted-foreground text-sm",
              state.checkFailed && isIdle && "text-destructive-text",
            )}
          >
            {isIdle && getIdleHint()}
            {isRecording && t("Listening… Tap Stop to check.")}
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
}: {
  canListen: boolean;
  canSpeak: boolean;
  cantTalk: boolean;
  micBlocked: boolean;
}): AnswerMode {
  if ((cantTalk || !canSpeak) && canListen) {
    return "listen";
  }

  return cantTalk || micBlocked || !canSpeak ? "type" : "speak";
}

/**
 * How the learner answers now. Speaking is the default; "I can't talk now" plays the sentence as
 * listening when the screen has it, or as typing when it doesn't, on every speaking screen for the
 * rest of the day; typing also covers a browser that can't record and a microphone blocked when
 * they tap to speak, which brings up the typing field right away with a line saying why.
 */
function useAnswerMode({
  onAnswer,
  step,
}: Pick<LessonStepViewProps<StepOf<"spokenAnswer">>, "onAnswer" | "step">) {
  const { adapters } = useLessonPlayerConfig();
  const canRecord = useCanRecord();
  const canSpeak = Boolean(adapters.gradeSpokenAnswer) && canRecord;
  const canListen = step.listening !== null;
  const [cantTalk, setCantTalk] = useTodayChoice(CANT_TALK_TODAY);
  const [micBlocked, setMicBlocked] = useState(false);

  const mode = getAnswerMode({ canListen, canSpeak, cantTalk, micBlocked });

  /** An answer started one way doesn't carry over to another; asking to speak tries the mic again. */
  const switchTo = (next: { cantTalk: boolean }) => {
    onAnswer(null);
    setCantTalk(next.cantTalk);
    setMicBlocked(false);
  };

  return {
    canListen,
    canSpeak,
    cantTalk,
    micBlocked,
    mode,
    onBlocked: () => setMicBlocked(true),
    switchTo,
  };
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
  const { canListen, canSpeak, cantTalk, mode, switchTo } = answerMode;

  if (isLocked || !canSpeak) {
    return null;
  }

  if (mode === "speak") {
    return (
      <Button
        className={COLUMN_GHOST_ACTION_CLASS}
        onClick={() => switchTo({ cantTalk: true })}
        size="sm"
        variant="ghost"
      >
        {canListen ? <HeadphonesIcon aria-hidden="true" /> : <KeyboardIcon aria-hidden="true" />}
        {t("I can't talk now")}
      </Button>
    );
  }

  return (
    <Button
      className={COLUMN_GHOST_ACTION_CLASS}
      onClick={() => switchTo({ cantTalk: false })}
      size="sm"
      variant="ghost"
    >
      <MicIcon aria-hidden="true" />
      {cantTalk ? t("I can talk now") : t("Say it instead")}
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
            <p className="text-muted-foreground text-sm" role="status">
              {t("The microphone is blocked. Type your answer instead.")}
            </p>
          )}

          {/* Replacing Record after a blocked microphone, the field takes Record's focus. */}
          <LessonAnswerField
            autoFocusOnPointer={answerMode.micBlocked}
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
