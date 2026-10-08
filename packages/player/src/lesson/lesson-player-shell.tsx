"use client";

import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { PlayerAudioProvider } from "../player-audio-context";
import { getPlayerStepAudioUrl } from "../player-step";
import { LESSON_CONTENT_ID } from "./_utils/lesson-focus";
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
import { useScreenTurn, useScreenTurns } from "./use-screen-turns";
import { useSwipeNavigation } from "./use-swipe-navigation";

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

  // The server's tally once the lesson is saved: it's what counted.
  const verdicts = Object.values(state.firstVerdicts);

  const props = {
    completion,
    correctCount: completion.result?.correctCount ?? verdicts.filter(Boolean).length,
    incorrectCount:
      completion.result?.incorrectCount ?? verdicts.filter((isCorrect) => !isCorrect).length,
    onRetry: actions.retryCompletion,
  };

  return slots.completion ? slots.completion(props) : <LessonCompletionMoment {...props} />;
}

function LessonContent() {
  const { screen, state } = useLessonPlayer();
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const turn = useScreenTurn(state);
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
      <div className="flex flex-1 flex-col">
        <LessonStage turn={turn} />
      </div>
      <LessonActionBar />
    </PlayerAudioProvider>
  );
}

/**
 * The lesson player: a header with the lesson's title and progress, the screen in the middle, and
 * one next action at the bottom. No navigation bar: a lesson has the whole screen. On a touch
 * screen, a swipe turns reading screens like a story, wherever the arrow keys do.
 */
export function LessonPlayerShell() {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const mainRef = useRef<HTMLElement>(null);

  const turns = useScreenTurns();

  useLessonKeyboard();
  useRevealFeedback(mainRef);
  useSwipeNavigation({ onBack: turns.back, onForward: turns.forward, ref: mainRef });

  return (
    <div
      className="ph-no-rageclick bg-background flex h-dvh flex-col overflow-hidden"
      data-phase={state.phase}
      data-slot="lesson-player"
    >
      <LessonPlayerHeader />
      <LessonSounds />

      {/*
       * Screens start at the top on every size, so nothing jumps from one screen to the next. A
       * screen sliding in never scrolls the page sideways.
       */}
      <main
        aria-label={t("Lesson content")}
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none"
        id={LESSON_CONTENT_ID}
        ref={mainRef}
        tabIndex={-1}
      >
        <div className="flex min-h-full flex-col lg:pt-4">
          <LessonContent />
        </div>
      </main>
    </div>
  );
}
