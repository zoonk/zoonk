"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { CreateAccountLink } from "../../_components/create-account-link";
import {
  OnboardingColumn,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../../onboarding/onboarding-frame";
import { OnboardingNoBack } from "../../onboarding/onboarding-host";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { useNoSpeechMessage } from "../no-speech-message";
import { ListeningMessage, SpeakingPrompt } from "./level-test-parts";

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;
type NextStep = ReadyTest["next"];

/**
 * A reading or listening question, as placement asks it: a listening one plays a voice message
 * instead of showing the text, and "I don't know" says the audio wasn't understood.
 */
export function LevelTestQuestion({
  answer,
  onStop,
  onView,
  question,
  targetLanguage,
}: {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  onStop: () => void;
  onView: (view: LanguageLevelTestView) => void;
  question: Extract<NextStep, { kind: "question" }>["question"];
  targetLanguage: string;
}) {
  const t = useExtracted();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isListening = question.skill === "listening";

  return (
    <PlacementQuestionScreen
      dontKnowLabel={isListening ? t("I didn't understand the audio") : undefined}
      error={failed ? t("We couldn't save your answer. Try again.") : null}
      key={question.id}
      media={
        isListening ? <ListeningMessage language={targetLanguage} text={question.passage} /> : null
      }
      onAnswer={(choice, durationMs) =>
        startTransition(async () => {
          const answerIndex = "selectedIndex" in choice ? choice.selectedIndex : null;
          const view = await answer({ answerIndex, durationMs, questionId: question.id });
          setFailed(!view);

          if (view) {
            onView(view);
          }
        })
      }
      onStop={onStop}
      pending={isPending}
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

/**
 * The one sentence out loud: record it, and it's checked word by word. Like the test's other
 * questions, it has no way back.
 */
export function SpeakingStep({
  onSkip,
  onView,
  sentence,
  speak,
}: {
  onSkip: () => void;
  onView: (view: LanguageLevelTestView) => void;
  sentence: Extract<NextStep, { kind: "speaking" }>;
  speak: (audio: Blob) => Promise<LanguageLevelTestView | "noSpeech" | "signUpRequired" | null>;
}) {
  const t = useExtracted();
  const noSpeech = useNoSpeechMessage();
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <OnboardingNoBack>
      <OnboardingColumn>
        <OnboardingHeading>
          <OnboardingTitle>{t("Say it out loud")}</OnboardingTitle>
        </OnboardingHeading>

        <SpeakingPrompt
          error={error}
          onRecorded={(audio) =>
            startTransition(async () => {
              const result = await speak(audio);
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
            })
          }
          pending={isPending}
          sentence={sentence}
        />
        <OnboardingFooter>
          {needsAccount && <CreateAccountLink />}
          <OnboardingSecondaryButton disabled={isPending} onClick={onSkip}>
            {t("Skip this part")}
          </OnboardingSecondaryButton>
        </OnboardingFooter>
      </OnboardingColumn>
    </OnboardingNoBack>
  );
}
