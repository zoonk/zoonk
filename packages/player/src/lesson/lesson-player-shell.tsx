"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { PlayerAudioProvider } from "../player-audio-context";
import { getPlayerStepAudioUrl } from "../player-step";
import { isLanguageStep } from "./_utils/lesson-steps";
import { LessonAccessScreen } from "./access/lesson-access-screen";
import { LessonCompletionMoment } from "./completion/lesson-completion-moment";
import { LessonActionBar } from "./lesson-action-bar";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonPlayerHeader } from "./lesson-player-header";
import { type PlayableLibraryStep } from "./lesson-player-types";
import { LessonSounds } from "./lesson-sounds";
import { LessonStage } from "./lesson-stage";
import { useLessonKeyboard } from "./use-lesson-keyboard";
import { useRevealFeedback } from "./use-reveal-feedback";

/** The prompt audio of a language screen (a word, a letter, a sentence to hear), if it has one. */
function getPromptAudioUrl(step: PlayableLibraryStep | null): string | null {
  return step && isLanguageStep(step) ? getPlayerStepAudioUrl(step.exercise) : null;
}

function LessonCompletion() {
  const { actions, state } = useLessonPlayer();
  const { slots } = useLessonPlayerConfig();
  const { completion } = state;

  if (!completion) {
    return null;
  }

  const verdicts = Object.values(state.firstVerdicts);

  const props = {
    completion,
    correctCount: verdicts.filter(Boolean).length,
    incorrectCount: verdicts.filter((isCorrect) => !isCorrect).length,
    onRestart: actions.restart,
    onRetry: actions.retryCompletion,
  };

  return slots.completion ? slots.completion(props) : <LessonCompletionMoment {...props} />;
}

function LessonContent() {
  const { screen, state } = useLessonPlayer();
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const audioUrl = getPromptAudioUrl(screen.step);

  if (state.run.status === "refused") {
    return <LessonAccessScreen refusal={state.run.refusal} />;
  }

  if (state.phase === "completed") {
    return <LessonCompletion />;
  }

  return (
    <PlayerAudioProvider
      audioUrl={audioUrl}
      autoPlayAudio={autoPlayAudio}
      key={`${screen.step?.id}:${audioUrl ?? "no-audio"}`}
      onAutoPlayAudioEnabled={() => setAutoPlayAudio(true)}
    >
      <div className="flex flex-1 flex-col lg:flex-none">
        <LessonStage />
      </div>
      <LessonActionBar />
    </PlayerAudioProvider>
  );
}

/**
 * The lesson player: a header with the skin's progress, the screen in the middle, and one next
 * action at the bottom. No navigation bar: a lesson has the whole screen.
 */
export function LessonPlayerShell() {
  const t = useExtracted();
  const { skin } = useLessonPlayerConfig();
  const { state } = useLessonPlayer();
  const mainRef = useRef<HTMLElement>(null);

  useLessonKeyboard();
  useRevealFeedback(mainRef);

  return (
    <div
      className={cn("ph-no-rageclick flex h-dvh flex-col overflow-hidden", skin.frameClassName)}
      data-phase={state.phase}
      data-slot="lesson-player"
    >
      <LessonPlayerHeader />
      <LessonSounds />

      <main
        aria-label={t("Lesson content")}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        ref={mainRef}
      >
        <div className="flex min-h-full flex-col lg:justify-center lg:py-8">
          <LessonContent />
        </div>
      </main>
    </div>
  );
}
