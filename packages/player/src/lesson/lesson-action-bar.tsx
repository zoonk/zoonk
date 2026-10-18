"use client";

import {
  TASK_BACK_ACTION_CLASS,
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
} from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayAudioButton } from "../components/play-audio-button";
import { usePromptAudioUrl } from "../player-audio-context";
import { LESSON_PRIMARY_ID } from "./_utils/lesson-focus";
import { isReadStep } from "./_utils/lesson-steps";
import { useLessonPlayer } from "./lesson-player-context";
import { type LessonPrimaryLabel } from "./lesson-player-screen";
import { AskTutorButton } from "./tutor/ask-tutor-button";
import { useShowsMiss } from "./tutor/use-shows-miss";

function PrimaryLabel({ label }: { label: LessonPrimaryLabel }) {
  const t = useExtracted();

  const labels: Record<LessonPrimaryLabel, string> = {
    check: t("Check"),
    checking: t("Checking your answer"),
    confirm: t("Confirm"),
    continue: t("Continue"),
    next: t("Next"),
    nextStep: t("Show the next step"),
    seeAnswer: t("See the answer"),
    seeHowItWent: t("See how it went"),
    start: t("Start"),
  };

  return labels[label];
}

/**
 * A card's sound (a word, a letter) beside Next; a listening question plays its own sentence.
 * Playing it once plays the next cards' sounds on arrival.
 */
function PromptAudio() {
  const { screen } = useLessonPlayer();
  const audioUrl = usePromptAudioUrl();

  if (!audioUrl || !screen.step || !isReadStep(screen.step)) {
    return null;
  }

  return <PlayAudioButton audioUrl={audioUrl} variant="icon" />;
}

/**
 * The task's action bar: the one next action, with Previous on every screen after the first and a
 * card's sound on reading screens. The buddy is an icon after the main action, and says its name
 * before it after a wrong answer, when asking helps most, unless the buddy's own offer to help
 * already says it on the screen; from `lg` the buddy is in the aside instead. The bar stays pinned
 * at the bottom over a hairline on every size, so it never moves when a result appears, and Enter
 * always does what it says. Every button is 44px tall.
 */
export function LessonActionBar() {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();
  const { primary } = screen;
  const showsMiss = useShowsMiss() && !screen.struggleOffer;

  if (!primary) {
    return null;
  }

  const runPrimary = primary.action === "check" ? actions.check : actions.continue;

  return (
    <TaskActionBar data-slot="lesson-action-bar">
      <TaskActions>
        {screen.canGoBack && (
          <Button
            aria-keyshortcuts="ArrowLeft"
            className={TASK_BACK_ACTION_CLASS}
            onClick={actions.goBack}
            size="icon"
            variant="outline"
          >
            <ChevronLeftIcon aria-hidden="true" />
            <span className="sr-only">{t("Previous screen")}</span>
          </Button>
        )}

        <PromptAudio />

        {showsMiss && <AskTutorButton labeled />}

        <Button
          aria-keyshortcuts="Enter"
          className={cn(TASK_MAIN_ACTION_CLASS, primary.busy && "disabled:opacity-100")}
          disabled={primary.disabled}
          id={LESSON_PRIMARY_ID}
          onClick={runPrimary}
          size="xl"
        >
          {primary.busy && <Spinner aria-hidden="true" />}
          <PrimaryLabel label={primary.label} />
          {!primary.busy && <ShortcutKbd tone="inverse">⏎</ShortcutKbd>}
        </Button>

        {!showsMiss && <AskTutorButton />}
      </TaskActions>
    </TaskActionBar>
  );
}
