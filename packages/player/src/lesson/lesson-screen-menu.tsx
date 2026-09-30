"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { EllipsisIcon, ImageIcon, NotebookTextIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { SummarySheet } from "./controls/summary-sheet";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { type PlayableLibraryStep } from "./lesson-player-types";

/**
 * The lesson's summary card, one tap away from the menu. The menu closes as the sheet opens, so
 * a ref (not state from the click's render) tells the menu to keep the lesson's keys paused.
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

/** Language exercises have no image of their own; teaching screens may. */
function getStepImageId(step: PlayableLibraryStep): string | null {
  return "image" in step && step.image ? step.image.id : null;
}

/**
 * The image's own votes, one level down, so a vote on a picture reaches the picture and the
 * screen's votes stay about its text.
 */
function ImageMenuItems({ imageId }: { imageId: string }) {
  const t = useExtracted();
  const { slots } = useLessonPlayerConfig();

  if (!slots.screenMenuItems) {
    return null;
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ImageIcon aria-hidden="true" />
        {t("Image")}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="w-56">
        {slots.screenMenuItems({ contentId: imageId, contentKind: "mediaAsset" })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * The screen's "…" menu: that the lesson was made with AI and may contain mistakes (said once
 * here, not on every screen), the lesson's summary card, then votes and "Report a problem" from
 * the host's feedback slot, about the screen in view and its image. Always there and never in the
 * way.
 */
export function LessonScreenMenu() {
  const t = useExtracted();
  const { lesson, slots } = useLessonPlayerConfig();
  const { screen } = useLessonPlayer();
  const summary = useSummarySheet();

  if (!screen.step) {
    return null;
  }

  const imageId = slots.screenMenuItems ? getStepImageId(screen.step) : null;

  return (
    <>
      {/* While the menu is open, Enter picks its items and Escape closes it: the lesson's keys wait. */}
      <DropdownMenu onOpenChange={summary.onMenuOpenChange}>
        <DropdownMenuTrigger render={<Button className="shrink-0" size="icon" variant="ghost" />}>
          <EllipsisIcon aria-hidden="true" />
          <span className="sr-only">{t("Screen options")}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-start gap-2" data-slot="lesson-ai-note">
              <SparklesIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {t("Made with AI. It may contain mistakes.")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          {lesson.summaryIdeas.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => summary.change(true)}>
                <NotebookTextIcon aria-hidden="true" />
                {t("Lesson summary")}
              </DropdownMenuItem>
            </>
          )}

          {slots.screenMenuItems && (
            <>
              <DropdownMenuSeparator />
              {slots.screenMenuItems({ contentId: screen.step.id, contentKind: "step" })}
            </>
          )}

          {imageId && (
            <>
              <DropdownMenuSeparator />
              <ImageMenuItems imageId={imageId} />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SummarySheet ideas={lesson.summaryIdeas} onOpenChange={summary.change} open={summary.open} />
    </>
  );
}
