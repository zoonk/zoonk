"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { useExtracted } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { CreateAccountLink } from "../../_components/create-account-link";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";
import { OnboardingTestQuestion } from "../../onboarding/onboarding-host";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { RecordButton } from "../../speech/record-button";
import { useSpokenAudio } from "../../speech/use-spoken-audio";
import { useNoSpeechMessage } from "../no-speech-message";
import { ListeningMessage, SpeakingPrompt } from "./level-test-parts";

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;
type NextStep = ReadyTest["next"];

export function LevelTestQuestion({
  answer,
  audioPending,
  onStop,
  onView,
  progress,
  question,
  targetLanguage,
}: {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  audioPending: boolean;
  onStop: () => void;
  onView: (view: LanguageLevelTestView) => void;
  /** 0 to 1. */
  progress: number;
  question: Extract<NextStep, { kind: "question" }>["question"];
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
          const skipped = noAudio && "dontKnow" in choice;

          const view = await answer({
            answerIndex,
            durationMs,
            questionId: question.id,
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
        skillId: question.skill,
        visual: null,
      }}
    />
  );
}

export function SpeakingStep({
  onSkip,
  onView,
  progress,
  sentence,
  speak,
}: {
  onSkip: () => void;
  onView: (view: LanguageLevelTestView) => void;
  /** 0 to 1. */
  progress: number;
  sentence: Extract<NextStep, { kind: "speaking" }>;
  speak: (audio: Blob) => Promise<LanguageLevelTestView | "noSpeech" | "signUpRequired" | null>;
}) {
  const t = useExtracted();
  const noSpeech = useNoSpeechMessage();
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [isPending, startTransition] = useTransition();

  const send = useCallback(
    ({ audio }: { audio: Blob }) =>
      startTransition(async () => {
        const result = await speak(audio).catch(() => null);
        setNeedsAccount(result === "signUpRequired");

        if (result === "noSpeech") {
          setError(noSpeech);
          return;
        }

        if (result === "signUpRequired") {
          setError(t("Create your free account to continue."));
          return;
        }

        setError(result ? null : t("We couldn't check that. Try again."));

        if (result) {
          onView(result);
        }
      }),
    [noSpeech, onView, speak, t],
  );

  const canRecord = useCanRecord();
  const recorder = useVoiceRecorder({ onRecorded: send });
  const micAvailable = canRecord && recorder.status !== "denied";
  const recording = recorder.status === "recording";

  return (
    <OnboardingTestQuestion progress={progress}>
      <OnboardingColumn
        bar={
          <OnboardingActions note={needsAccount && <CreateAccountLink />}>
            <OnboardingSecondaryButton disabled={isPending} onClick={onSkip}>
              {t("Skip this part")}
            </OnboardingSecondaryButton>
            {micAvailable && (
              <RecordButton
                busy={recorder.status === "acquiring"}
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
          <OnboardingTitle>{t("Say it out loud")}</OnboardingTitle>
        </OnboardingHeading>
        <SpeakingPrompt
          error={error}
          micAvailable={micAvailable}
          pending={isPending}
          recording={recording}
          sentence={sentence}
        />
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
