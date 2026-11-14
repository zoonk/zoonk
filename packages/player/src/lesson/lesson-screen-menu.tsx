"use client";

import { TaskHeaderMenu, useTaskAsideShown } from "@zoonk/learn/task-header";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { NetworkIcon, PenOffIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { focusLessonAfterTurn, getLessonFocusTarget } from "./_utils/lesson-focus";
import { isNumberAnswer } from "./_utils/number-answer";
import { LessonMapSheet } from "./controls/lesson-map-sheet";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";

function useMapSheet(isDone: boolean) {
  const { setPaused } = useLessonInteraction();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  function change(next: boolean) {
    openRef.current = next;
    setOpen(next);
    setPaused(next);
  }

  const closeIfOpen = useEffectEvent(() => {
    if (openRef.current) {
      change(false);
    }
  });

  useEffect(() => {
    if (!isDone) {
      closeIfOpen();
    }
  }, [isDone]);

  function onMenuOpenChange(menuOpen: boolean) {
    setPaused(menuOpen || openRef.current);
  }

  return { change, onMenuOpenChange, open };
}

function AiNote() {
  const t = useExtracted();

  return (
    <DropdownMenuLabel className="flex items-start gap-2.5" data-slot="lesson-ai-note">
      <span className="flex h-lh w-4 shrink-0 items-center justify-center">
        <SparklesIcon aria-hidden="true" className="size-3.5" />
      </span>
      {t("Made with AI. It may contain mistakes.")}
    </DropdownMenuLabel>
  );
}

/** A written answer still open can be left out, with every other writing question of the day. */
function useCanSkipWriting(): boolean {
  const { showWritingAlternatives = true } = useLessonPlayerConfig();
  const { screen, state } = useLessonPlayer();
  const { step } = screen;

  return (
    step?.kind === "typedAnswer" &&
    state.phase === "playing" &&
    showWritingAlternatives &&
    !isNumberAnswer(step.content.acceptedAnswers)
  );
}

export function LessonScreenMenu() {
  const t = useExtracted();
  const { lesson, slots } = useLessonPlayerConfig();
  const { actions, screen, state } = useLessonPlayer();
  const canSkipWriting = useCanSkipWriting();
  const isDone = state.phase === "completed";
  const mapSheet = useMapSheet(isDone);
  const asideShown = useTaskAsideShown();

  if (!screen.step && !isDone && state.phase !== "map") {
    return null;
  }

  const showsMap = isDone && lesson.summary && (slots.completion || !asideShown);

  const reportItem =
    screen.step && slots.reportMenuItem?.({ contentId: screen.step.id, contentKind: "step" });

  return (
    <>
      <TaskHeaderMenu
        onOpenChange={mapSheet.onMenuOpenChange}
        className="w-64"
        finalFocus={getLessonFocusTarget}
      >
        <DropdownMenuGroup>
          <AiNote />
        </DropdownMenuGroup>

        {(canSkipWriting || screen.canKnowThis || showsMap || reportItem) && (
          <DropdownMenuSeparator />
        )}

        {canSkipWriting && (
          <DropdownMenuItem
            onClick={() => {
              actions.skipWriting();
              focusLessonAfterTurn();
            }}
          >
            <PenOffIcon aria-hidden="true" />
            {t("Skip writing questions today")}
          </DropdownMenuItem>
        )}

        {screen.canKnowThis && (
          <DropdownMenuItem onClick={actions.knowThis}>
            <ZapIcon aria-hidden="true" />
            {t("I already know this")}
          </DropdownMenuItem>
        )}

        {showsMap && (
          <DropdownMenuItem aria-haspopup="dialog" onClick={() => mapSheet.change(true)}>
            <NetworkIcon aria-hidden="true" />
            {t("Lesson map")}
          </DropdownMenuItem>
        )}

        {reportItem}
      </TaskHeaderMenu>

      {lesson.summary && (
        <LessonMapSheet
          map={lesson.summary}
          onOpenChange={mapSheet.change}
          open={mapSheet.open}
          title={lesson.title}
        />
      )}
    </>
  );
}
