"use client";

import { getTaskAsideRootProps } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { PlayerAudioProvider } from "../player-audio-context";
import { getPlayerStepAudioUrl } from "../player-step";
import { LESSON_CONTENT_ID } from "./_utils/lesson-focus";
import { isLanguageStep } from "./_utils/lesson-steps";
import { LessonAccessScreen } from "./access/lesson-access-screen";
import { LessonCompletionMoment } from "./completion/lesson-completion-moment";
import { LessonCompletionReady } from "./completion/lesson-completion-ready";
import { useCompletionProps } from "./completion/use-completion-props";
import { LessonActionBar } from "./lesson-action-bar";
import { LessonAside } from "./lesson-aside";
import { LessonLeaveProvider } from "./lesson-leave";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonPlayerHeader } from "./lesson-player-header";
import { type LessonPlayerState } from "./lesson-player-state";
import { type PlayableLibraryStep } from "./lesson-player-types";
import { LessonScreenMenu } from "./lesson-screen-menu";
import { LessonSounds } from "./lesson-sounds";
import { LessonStage } from "./lesson-stage";
import { DockedConversation } from "./tutor/lesson-dock";
import { useLessonBuddy } from "./tutor/lesson-tutor";
import { useLessonKeyboard } from "./use-lesson-keyboard";
import { useRevealFeedback } from "./use-reveal-feedback";
import { useScreenTurn, useScreenTurns } from "./use-screen-turns";
import { useSwipeNavigation } from "./use-swipe-navigation";

/** The prompt audio of a language screen (a word, a letter, a sentence to hear), if it has one. */
function getPromptAudioUrl(step: PlayableLibraryStep | null): string | null {
  return step && isLanguageStep(step) ? getPlayerStepAudioUrl(step.exercise) : null;
}

/** A screen of the lesson is in play: the buddy's composer docks in the aside beside it. */
function isPlayingScreen(state: LessonPlayerState): boolean {
  return state.phase !== "completed" && state.run.status !== "refused";
}

function LessonCompletion() {
  const { slots } = useLessonPlayerConfig();
  const { actions, state } = useLessonPlayer();
  const props = useCompletionProps();

  if (state.completion?.status === "ready") {
    return <LessonCompletionReady onFinish={actions.retryCompletion} />;
  }

  if (!props) {
    return null;
  }

  return slots.completion ? slots.completion(props) : <LessonCompletionMoment {...props} />;
}

/**
 * The lesson's header, or the host's once the lesson is done (a session block shows the day's
 * session there), when it has one to show, with the lesson's menu; until then the lesson's stays.
 */
function LessonHeader() {
  const { slots } = useLessonPlayerConfig();
  const props = useCompletionProps();

  const completionHeader = props
    ? slots.completionHeader?.({ ...props, menu: <LessonScreenMenu /> })
    : null;

  return completionHeader ?? <LessonPlayerHeader />;
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
 * The lesson player: a header with ✕ and "…" in the window's corners and the lesson's title and
 * progress over the column, the screen in the column (everything it shows, its situation, picture
 * or chart included), and one next action at the bottom. No navigation bar: a lesson has the whole
 * screen. From `lg` an aside sits beside the screen under the header's row with what helps with it
 * (the text a question checks, the outline, the buddy), the column and the aside centered together.
 * On a touch screen, a swipe turns reading screens like a story, wherever the arrow keys do.
 */
export function LessonPlayerShell() {
  return (
    <LessonLeaveProvider>
      <LessonPlayerFrame />
    </LessonLeaveProvider>
  );
}

function LessonPlayerFrame() {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const buddy = useLessonBuddy();
  const mainRef = useRef<HTMLElement>(null);
  const hasDock = Boolean(buddy) && isPlayingScreen(state);
  const asideRoot = getTaskAsideRootProps();

  const turns = useScreenTurns();

  useLessonKeyboard();
  useRevealFeedback(mainRef);
  useSwipeNavigation({ onBack: turns.back, onForward: turns.forward, ref: mainRef });

  return (
    <div
      className={cn(
        "ph-no-rageclick bg-background flex h-dvh flex-col overflow-hidden",
        asideRoot.className,
      )}
      data-aside={asideRoot["data-aside"]}
      data-phase={state.phase}
      data-slot="lesson-player"
    >
      <LessonHeader />
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
        <div className="flex min-h-full flex-col">
          <LessonContent />
        </div>
      </main>

      <LessonAside />
      {hasDock && buddy?.docked && <DockedConversation />}
    </div>
  );
}
