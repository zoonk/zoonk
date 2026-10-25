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
import { useRef, useState } from "react";
import { getLessonFocusTarget } from "./_utils/lesson-focus";
import { SummarySheet } from "./controls/summary-sheet";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";

/**
 * The lesson's summary card, one tap away from the menu once the lesson is done. The menu closes
 * as the sheet opens, so a ref (not state from the click's render) tells the menu to keep the
 * lesson's keys paused.
 */
function useSummarySheet() {
  const { setPaused } = useLessonInteraction();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  function change(next: boolean) {
    openRef.current = next;
    setOpen(next);
    setPaused(next);
  }

  function onMenuOpenChange(menuOpen: boolean) {
    setPaused(menuOpen || openRef.current);
  }

  return { change, onMenuOpenChange, open };
}

/**
 * The screen's "…" menu, for what the learner rarely needs: that the lesson was made with AI and
 * may contain mistakes (said once here, not on every screen), "I already know this" on an
 * explanation, "Report a problem" from the host and, once the lesson is done, its summary card.
 * Not before: the summary states what the questions ahead ask. Closing it hands focus back to the
 * lesson, so Enter goes on instead of opening the menu again.
 */
export function LessonScreenMenu() {
  const t = useExtracted();
  const { lesson, slots } = useLessonPlayerConfig();
  const { actions, screen, state } = useLessonPlayer();
  const summary = useSummarySheet();
  const isDone = state.phase === "completed";

  if (!screen.step && !isDone) {
    return null;
  }

  return (
    <>
      {/* While the menu is open, Enter picks its items and Escape closes it: the lesson's keys wait. */}
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
