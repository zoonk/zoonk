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

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function TargetText({ step }: { step: StepOf<"spokenAnswer"> }) {
  const { romanization, targetText, translation } = step.content;
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
            {isRecording &&
              t({
                description: "“Stop” is the label of the button that ends the recording.",
                message: "Listening… Tap Stop to check.",
              })}
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
