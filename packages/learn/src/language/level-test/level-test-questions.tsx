"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { useExtracted } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";
import { OnboardingTestQuestion } from "../../onboarding/onboarding-host";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { RecordButton } from "../../speech/record-button";
import { RecordCue } from "../../speech/record-cue";
import { type RecordProblem, useRecordNote } from "../../speech/record-note";
import { useSpokenAudio } from "../../speech/use-spoken-audio";
import { ListeningMessage } from "./level-test-parts";

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;
type NextStep = ReadyTest["next"];

export function LevelTestQuestion({
  answer,
  audioPending,
  onStop,
  onView,
  progress,
  question,
  selectAll = false,
  targetLanguage,
}: {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  audioPending: boolean;
  onStop: () => void;
  onView: (view: LanguageLevelTestView) => void;
  /** 0 to 1. */
  progress: number;
  question: Extract<NextStep, { kind: "question" }>["question"];
  /** A level's confirmation: every right option is picked, so a guess rarely passes. */
  selectAll?: boolean;
  targetLanguage: string;
}) {
  const t = useExtracted();
  const [failures, setFailures] = useState(0);
  const [isPending, startTransition] = useTransition();
  const speech = useSpokenAudio(targetLanguage);
  const isListening = question.skill === "listening";
  const noAudio = isListening && (audioPending || speech.state.status === "failed");
  const listeningOut = noAudio ? t("Skip this question") : t("I didn't understand the audio");

  return (
    <PlacementQuestionScreen
      dontKnowLabel={isListening ? listeningOut : undefined}
      failures={failures}
      key={question.id}
      media={
        isListening ? (
          <ListeningMessage
            language={targetLanguage}
            pending={audioPending}
            question={question}
            speech={speech}
          />
        ) : null
      }
      onAnswer={(choice, durationMs) =>
        startTransition(async () => {
          const answerIndex = "selectedIndex" in choice ? choice.selectedIndex : null;
          const answerIndices = "selectedIndexes" in choice ? choice.selectedIndexes : undefined;
          const skipped = noAudio && "dontKnow" in choice;

          const view = await answer({
            answerIndex,
            durationMs,
            questionId: question.id,
            ...(answerIndices && { answerIndices }),
            ...(skipped && { skipped }),
          }).catch(() => null);

          if (!view) {
            setFailures((count) => count + 1);
            return;
          }

          onView(view);
        })
      }
      onStop={onStop}
      pending={isPending}
      progress={progress}
      question={{
        context: isListening ? null : question.passage,
        format: "multipleChoice",
        image: null,
        itemId: question.id,
        options: question.options,
        question: question.question,
        select: selectAll ? "all" : 1,
        skillId: question.skill,
        visual: null,
      }}
    />
  );
}

export function SpeakingStep({
  language,
  onSkip,
  onView,
  progress,
  sentence,
  speak,
}: {
  language: string;
  onSkip: () => void;
  onView: (view: LanguageLevelTestView) => void;
  /** 0 to 1. */
  progress: number;
  sentence: Extract<NextStep, { kind: "speaking" }>;
  speak: (audio: Blob) => Promise<LanguageLevelTestView | "noSpeech" | "signUpRequired" | null>;
}) {
  const t = useExtracted();
  const [problem, setProblem] = useState<RecordProblem | null>(null);
  const [isPending, startTransition] = useTransition();

  const send = useCallback(
    ({ audio }: { audio: Blob }) =>
      startTransition(async () => {
        const result = await speak(audio).catch(() => null);

        if (result === null || result === "noSpeech" || result === "signUpRequired") {
          setProblem(result ?? "failed");
          return;
        }

        setProblem(null);
        onView(result);
      }),
    [onView, speak],
  );

  const canRecord = useCanRecord();
  const recorder = useVoiceRecorder({ onRecorded: send });
  const micAvailable = canRecord && recorder.status !== "denied";
  const recording = recorder.status === "recording";

  const note = useRecordNote({
    checking: isPending,
    problem,
    recording: recording || recorder.status === "acquiring",
    unavailable: micAvailable
      ? null
      : t("We can't use your microphone, so skip this part."),
  });

  return (
    <OnboardingTestQuestion progress={progress}>
      <OnboardingColumn
        bar={
          <OnboardingActions note={note}>
            <OnboardingSecondaryButton disabled={isPending} onClick={onSkip}>
              {t("Skip this part")}
            </OnboardingSecondaryButton>
            {micAvailable && (
              <RecordButton
                busy={recorder.status === "acquiring" || isPending}
                disabled={isPending}
                elapsedMs={recorder.elapsedMs}
                onStart={() => void recorder.start()}
                onStop={recorder.stop}
                recording={recording}
              />
            )}
          </OnboardingActions>
        }
      >
        <OnboardingHeading>
          <OnboardingTitle lang={language}>{sentence.speaking.sentence}</OnboardingTitle>
          <OnboardingDescription>{sentence.speaking.translation}</OnboardingDescription>
        </OnboardingHeading>

        {micAvailable && <RecordCue checking={isPending} recorder={recorder} />}
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
