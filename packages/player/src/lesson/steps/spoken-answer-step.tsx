"use client";

import { toListeningStep } from "@zoonk/core/lesson-player/grade";
import { MainActionInBar } from "@zoonk/learn/main-action-slot";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { RecordButton } from "@zoonk/learn/speech/record-button";
import { useRecordNote } from "@zoonk/learn/speech/record-note";
import {
  type MicrophoneProblem,
  useCanRecord,
  useVoiceRecorder,
} from "@zoonk/ui/hooks/voice-recorder";
import { MicIcon, MicOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { InteractiveStepLayout } from "../../components/step-layouts";
import { StepWayOut } from "../../components/step-way-out";
import { PlayerAudioProvider } from "../../player-audio-context";
import { LessonHelpLimitNotice } from "../_components/help-limit-notice";
import { splitQuestionData } from "../_utils/lesson-aside";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { CANT_LISTEN_TODAY, CANT_TALK_TODAY, useTodayChoice } from "../use-today-choice";
import { ExerciseStepView } from "./exercise-step";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

function TargetText({ step }: { step: StepOf<"spokenAnswer"> }) {
  const { romanization, targetText, translation } = step.content;
  const showsTranslation = translation && translation.trim() !== targetText.trim();

  return (
    <div className="flex flex-col gap-1">
      <h2
        className="text-2xl leading-tight font-semibold tracking-[-0.02em]"
        lang={step.content.language}
      >
        {targetText}
      </h2>
      {romanization && <p className="text-muted-foreground text-sm">{romanization}</p>}
      {showsTranslation && <p className="text-muted-foreground text-sm">{translation}</p>}
    </div>
  );
}

/** Recording is this step's answer, so Record and Stop take the bar's place where Check is. */
function RecordAnswer({
  onProblem,
  stepId,
}: {
  onProblem: (problem: MicrophoneProblem) => void;
  stepId: string;
}) {
  const { actions, state } = useLessonPlayer();

  const onRecorded = useCallback(
    ({ audio, durationMs }: { audio: Blob; durationMs: number }) =>
      actions.submitSpokenAnswer({ audio, durationMs, stepId }),
    [actions, stepId],
  );

  const recorder = useVoiceRecorder({ onRecorded });
  const isRecording = recorder.status === "recording";

  const startRecording = async () => {
    actions.startRecording();

    const started = await recorder.start();

    if (started === "blocked" || started === "unavailable") {
      onProblem(started);
    }
  };

  const isIdle = recorder.status === "idle" || recorder.status === "acquiring";
  const issue = isIdle ? state.checkIssue : null;
  const limit = issue?.status === "noSpeech" ? null : issue;

  const note = useRecordNote({
    acquiring: recorder.status === "acquiring",
    problem: issue?.status === "noSpeech" ? "noSpeech" : null,
    recording: isRecording,
  });

  return (
    <>
      <div aria-live="polite" className="empty:hidden">
        {limit && <LessonHelpLimitNotice limit={limit} />}
      </div>

      <MainActionInBar note={!limit && (isIdle || isRecording) && note}>
        <RecordButton
          busy={recorder.status === "acquiring"}
          elapsedMs={recorder.elapsedMs}
          onStart={() => void startRecording()}
          onStop={recorder.stop}
          preparation={recorder}
          recording={isRecording}
        />
      </MainActionInBar>
    </>
  );
}

type AnswerMode = "listen" | "speak" | "type";

function getAnswerMode({
  canListen,
  canSpeak,
  cantTalk,
  micProblem,
}: {
  canListen: boolean;
  canSpeak: boolean;
  cantTalk: boolean;
  micProblem: MicrophoneProblem | null;
}): AnswerMode {
  if ((cantTalk || !canSpeak) && canListen) {
    return "listen";
  }

  return cantTalk || micProblem || !canSpeak ? "type" : "speak";
}

/**
 * An answer shows the way it was given, whatever this device would offer now. A take sent for
 * checking has no text until it's heard.
 */
function getGivenMode({
  answer,
  result,
  step,
}: Pick<
  LessonStepViewProps<StepOf<"spokenAnswer">>,
  "answer" | "result" | "step"
>): AnswerMode | null {
  if (result?.heard) {
    return "speak";
  }

  if (answer?.kind === "spokenAnswer" && answer.text !== "") {
    return "type";
  }

  return answer?.kind === "listening" && step.listening ? "listen" : null;
}

function useAnswerMode({
  answer,
  onAnswer,
  result,
  step,
}: Pick<LessonStepViewProps<StepOf<"spokenAnswer">>, "answer" | "onAnswer" | "result" | "step">) {
  const { adapters, canRecordSpokenAnswer } = useLessonPlayerConfig();
  const canRecord = useCanRecord();

  const canSpeak =
    (Boolean(adapters.gradeSpokenAnswer) || Boolean(canRecordSpokenAnswer)) && canRecord;

  const [cantListen] = useTodayChoice(CANT_LISTEN_TODAY);
  const canListen = step.listening !== null && !cantListen;
  const [cantTalk, setCantTalk] = useTodayChoice(CANT_TALK_TODAY);
  const [micProblem, setMicProblem] = useState<MicrophoneProblem | null>(null);

  const mode =
    getGivenMode({ answer, result, step }) ??
    getAnswerMode({ canListen, canSpeak, cantTalk, micProblem });

  const switchTo = (next: { cantTalk: boolean }) => {
    onAnswer(null);
    setCantTalk(next.cantTalk);
    setMicProblem(null);
  };

  return { canListen, canSpeak, cantTalk, micProblem, mode, onProblem: setMicProblem, switchTo };
}

function ListeningInstead({
  props,
  step,
  wayOut,
}: {
  props: LessonStepViewProps<StepOf<"spokenAnswer">>;
  step: StepOf<"spokenAnswer"> & { listening: NonNullable<StepOf<"spokenAnswer">["listening"]> };
  wayOut: React.ReactNode;
}) {
  const [cantListen] = useTodayChoice(CANT_LISTEN_TODAY);

  return (
    <PlayerAudioProvider audioUrl={cantListen ? null : (step.listening.sentence?.audioUrl ?? null)}>
      <ExerciseStepView
        {...props}
        onCantListenChange={() => props.onAnswer(null)}
        step={toListeningStep({ listening: step.listening, step })}
        wayOut={wayOut}
      />
    </PlayerAudioProvider>
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
    const label = t("I can't talk now");

    const alternative = canListen
      ? t("Listen")
      : t({
          description:
            "On a question answered aloud: the learner types this one answer instead of saying it.",
          id: "typeSpokenAnswer",
          message: "Type instead",
        });

    return (
      <StepWayOut
        icon={<MicOffIcon aria-hidden="true" />}
        label={`${label}. ${alternative}`}
        onClick={() => switchTo({ cantTalk: true })}
      >
        {label}
      </StepWayOut>
    );
  }

  return (
    <StepWayOut icon={<MicIcon aria-hidden="true" />} onClick={() => switchTo({ cantTalk: false })}>
      {cantTalk ? t("I can talk now") : t("Say it instead")}
    </StepWayOut>
  );
}

export function SpokenAnswerStepView(props: LessonStepViewProps<StepOf<"spokenAnswer">>) {
  const t = useExtracted();
  const spoken = useSpokenText();
  const { answer, isLocked, onAnswer, result, step } = props;
  const answerMode = useAnswerMode({ answer, onAnswer, result, step });
  const { listening } = step;
  const text = answer?.kind === "spokenAnswer" ? answer.text : "";

  if (answerMode.mode === "listen" && listening) {
    return (
      <ListeningInstead
        props={props}
        step={{ ...step, listening }}
        wayOut={<ModeSwitch answerMode={answerMode} isLocked={isLocked} />}
      />
    );
  }

  return (
    <InteractiveStepLayout>
      <TargetText step={step} />

      {answerMode.mode === "type" ? (
        <>
          {/* Typing in place of speaking says why, unless the learner chose it ("I can't talk now"). */}
          {(answerMode.micProblem || !answerMode.canSpeak) && !isLocked && (
            <p className="text-muted-foreground text-sm" role="status">
              {answerMode.micProblem === "blocked"
                ? t("To speak instead, allow the microphone for Zoonk in your browser settings.")
                : t("We can't use your microphone, so type what you'd say.")}
            </p>
          )}

          <LessonAnswerField
            autoFocusOnPointer={answerMode.micProblem !== null}
            isLocked={isLocked}
            label={spoken.blocks(splitQuestionData(step.content.prompt).question)}
            onChange={(value) => onAnswer(value ? { kind: "spokenAnswer", text: value } : null)}
            value={text}
          />
        </>
      ) : (
        !isLocked && <RecordAnswer onProblem={answerMode.onProblem} stepId={step.id} />
      )}

      <ModeSwitch answerMode={answerMode} isLocked={isLocked} />
    </InteractiveStepLayout>
  );
}
