"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayAudioButton } from "../components/play-audio-button";
import { PlayerContentFrame } from "../components/step-layouts";
import { usePromptAudioUrl } from "../player-audio-context";
import { isReadStep } from "./_utils/lesson-steps";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { type LessonPrimaryLabel } from "./lesson-player-screen";
import { AskTutorButton } from "./tutor/ask-tutor-button";

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

  return <PlayAudioButton audioUrl={audioUrl} variant="outline" />;
}

/**
 * The one next action, with Previous and a card's sound on reading screens. It sticks to the bottom on phones and
 * sits under the content on desktop, and Enter always does what it says.
 */
export function LessonActionBar() {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();
  const { skin } = useLessonPlayerConfig();
  const { primary } = screen;

  if (!primary) {
    return null;
  }

  const runPrimary = primary.action === "check" ? actions.check : actions.continue;

  return (
    <div
      className="bg-background/90 sticky bottom-0 z-20 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:static lg:bg-transparent lg:backdrop-blur-none"
      data-slot="lesson-action-bar"
    >
      <PlayerContentFrame className="flex items-center gap-2 pt-3">
        {screen.canGoBack && (
          <Button
            aria-keyshortcuts="ArrowLeft"
            onClick={actions.goBack}
            size="icon-lg"
            variant="outline"
          >
            <ChevronLeftIcon aria-hidden="true" />
            <span className="sr-only">{t("Previous screen")}</span>
          </Button>
        )}

        <PromptAudio />

        <Button
          aria-keyshortcuts="Enter"
          className={cn(
            "h-12 flex-1 rounded-full text-base",
            primary.busy && "disabled:opacity-100",
          )}
          disabled={primary.disabled}
          onClick={runPrimary}
          size="lg"
          variant={skin.primaryVariant}
        >
          {/* One group, so the desktop layout (label left, shortcut right) keeps the arrow with it. */}
          <span className="inline-flex items-center gap-1.5">
            {primary.busy && <Spinner aria-hidden="true" />}
            <PrimaryLabel label={primary.label} />
            {primary.label === "next" && <ChevronRightIcon aria-hidden="true" />}
          </span>
          {!primary.busy && (
            <ShortcutKbd tone={skin.primaryVariant === "default" ? "inverse" : "default"}>
              Enter
            </ShortcutKbd>
          )}
        </Button>

        <AskTutorButton />
      </PlayerContentFrame>
    </div>
  );
}
