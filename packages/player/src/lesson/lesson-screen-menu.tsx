"use client";

import { TASK_HEADER_ICON_CLASS } from "@zoonk/learn/task-header";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon, NotebookTextIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getLessonFocusTarget } from "./_utils/lesson-focus";
import { SummarySheet } from "./controls/summary-sheet";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";

function useSummarySheet(isDone: boolean) {
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

export function LessonScreenMenu() {
  const t = useExtracted();
  const { lesson, slots } = useLessonPlayerConfig();
  const { actions, screen, state } = useLessonPlayer();
  const isDone = state.phase === "completed";
  const summary = useSummarySheet(isDone);

  if (!screen.step && !isDone) {
    return null;
  }

  return (
    <>
      <DropdownMenu onOpenChange={summary.onMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn("shrink-0", TASK_HEADER_ICON_CLASS.end)}
              size="icon"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
          <span className="sr-only">{t("Screen options")}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64" finalFocus={getLessonFocusTarget}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-start gap-2" data-slot="lesson-ai-note">
              <SparklesIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {t("Made with AI. It may contain mistakes.")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {screen.canKnowThis && (
            <DropdownMenuItem onClick={actions.knowThis}>
              <ZapIcon aria-hidden="true" />
              {t("I already know this")}
            </DropdownMenuItem>
          )}

          {isDone && lesson.summaryIdeas.length > 0 && (
            <DropdownMenuItem onClick={() => summary.change(true)}>
              <NotebookTextIcon aria-hidden="true" />
              {t("Lesson summary")}
            </DropdownMenuItem>
          )}

          {screen.step &&
            slots.reportMenuItem?.({ contentId: screen.step.id, contentKind: "step" })}
        </DropdownMenuContent>
      </DropdownMenu>

      <SummarySheet ideas={lesson.summaryIdeas} onOpenChange={summary.change} open={summary.open} />
    </>
  );
}
