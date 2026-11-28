"use client";

import { toListeningStep } from "@zoonk/core/lesson-player/grade";
import { MainActionInBar } from "@zoonk/learn/main-action-slot";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { RecordButton } from "@zoonk/learn/speech/record-button";
import { useRecordNote } from "@zoonk/learn/speech/record-note";
import { type MicrophoneProblem, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { MicIcon, MicOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { InteractiveStepLayout } from "../../components/step-layouts";
import { StepWayOut } from "../../components/step-way-out";
import { PlayerAudioProvider } from "../../player-audio-context";
import { LessonHelpLimitNotice } from "../_components/help-limit-notice";
import { splitQuestionData } from "../_utils/lesson-aside";
import { useLessonPlayer } from "../lesson-player-context";
import { getSpokenAnswerMode, useCanSpeak } from "../use-can-speak";
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
function RecordAnswer({ stepId }: { stepId: string }) {
  const t = useExtracted();
  const { actions, state } = useLessonPlayer();
  const [micProblem, setMicProblem] = useState<MicrophoneProblem | null>(null);

  const onRecorded = useCallback(
    ({ audio, durationMs }: { audio: Blob; durationMs: number }) =>
      actions.submitSpokenAnswer({ attemptId: crypto.randomUUID(), audio, durationMs, stepId }),
    [actions, stepId],
  );

  const recorder = useVoiceRecorder({ onRecorded });
  const isRecording = recorder.status === "recording";

  const startRecording = async () => {
    setMicProblem(null);
    actions.startRecording();

    const started = await recorder.start();

    if (started === "blocked" || started === "unavailable") {
      setMicProblem(started);
    }
  };

  const issue = isRecording ? null : state.checkIssue;
  const limit = issue?.status === "noSpeech" ? null : issue;

  const micLine =
    micProblem === "blocked"
      ? t({
          description:
            "The learner blocked the microphone for Zoonk in the browser. “Record” is the label of the button that starts the recording.",
          message: "Allow the microphone in your browser settings, then tap Record.",
        })
      : micProblem &&
        t({
          description:
            "The microphone couldn't start (missing, or in use by something else). “Record” is the label of the button that starts the recording.",
          message: "We can't use your microphone. Check it, then tap Record.",
        });

  const note = useRecordNote({
    acquiring: recorder.status === "acquiring",
    problem: issue?.status === "noSpeech" ? "noSpeech" : null,
    recording: isRecording,
    unavailable: micLine,
  });

  return (
    <>
      <div aria-live="polite" className="empty:hidden">
        {limit && <LessonHelpLimitNotice limit={limit} />}
      </div>

      <MainActionInBar note={!limit && note}>
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

/** "type" is only how an answer was given before speaking screens stopped offering typing. */
type AnswerMode = "listen" | "speak" | "type";

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
  const { actions, state } = useLessonPlayer();
  const canSpeak = useCanSpeak() ?? true;
  const [cantListen] = useTodayChoice(CANT_LISTEN_TODAY);
  const canListen = step.listening !== null && !cantListen;
  const [cantTalk, setCantTalk] = useTodayChoice(CANT_TALK_TODAY);

  const mode =
    getGivenMode({ answer, result, step }) ??
    getSpokenAnswerMode({ canListen, canSpeak, cantTalk });

  const switchTo = (next: { cantTalk: boolean }) => {
    onAnswer(null);

    if (!next.cantTalk && state.notice === "speakingSkipped") {
      actions.restoreSkipped();
    } else {
      setCantTalk(next.cantTalk);
    }
  };

  return { canListen, canSpeak, mode, switchTo };
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
  const { canListen, canSpeak, mode, switchTo } = answerMode;

  if (isLocked || !canSpeak || mode === "type") {
    return null;
  }

  if (mode === "speak") {
    const label = t("I can't talk now");

    return (
      <StepWayOut
        icon={<MicOffIcon aria-hidden="true" />}
        label={canListen ? `${label}. ${t("Listen")}` : label}
        onClick={() => switchTo({ cantTalk: true })}
      >
        {label}
      </StepWayOut>
    );
  }

  return (
    <StepWayOut icon={<MicIcon aria-hidden="true" />} onClick={() => switchTo({ cantTalk: false })}>
      {t("I can talk now")}
    </StepWayOut>
  );
}

export function SpokenAnswerStepView(props: LessonStepViewProps<StepOf<"spokenAnswer">>) {
  const t = useExtracted();
  const spoken = useSpokenText();
  const { answer, isLocked, onAnswer, result, step } = props;
  const answerMode = useAnswerMode({ answer, onAnswer, result, step });
  const { listening } = step;

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

      {answerMode.mode === "type" && (
        <LessonAnswerField
          isLocked
          label={spoken.blocks(splitQuestionData(step.content.prompt).question)}
          onChange={(value) => onAnswer(value ? { kind: "spokenAnswer", text: value } : null)}
          value={answer?.kind === "spokenAnswer" ? answer.text : ""}
        />
      )}

      {answerMode.mode === "speak" && !isLocked && <RecordAnswer stepId={step.id} />}

      {/* Only where nothing leaves this screen out, such as the mistakes notebook. */}
      {answerMode.mode === null && !answerMode.canSpeak && (
        <p className="text-muted-foreground text-sm">{t("This device can't record your voice.")}</p>
      )}

      <ModeSwitch answerMode={answerMode} isLocked={isLocked} />
    </InteractiveStepLayout>
  );
}
