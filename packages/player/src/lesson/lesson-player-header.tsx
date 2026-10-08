"use client";

import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "@zoonk/learn/task-header";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonScreenMenu } from "./lesson-screen-menu";

/**
 * An icon button on phones; with a keyboard at desktop size it widens to hold its "Esc" hint
 * inline, like the main action's "Enter", instead of a badge over the icon.
 */
function LessonCloseLink() {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();

  return (
    <LinkComponent
      aria-keyshortcuts="Escape"
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "lg:pointer-fine:w-auto lg:pointer-fine:gap-1.5 lg:pointer-fine:px-2.5",
      )}
      href={routes.exit}
    >
      <XIcon />
      <ShortcutKbd>Esc</ShortcutKbd>
      <span className="sr-only">{t("Close lesson")}</span>
    </LinkComponent>
  );
}

/** The screens passed so far, as a share of the lesson. */
function useLessonProgress(): number {
  const { screen } = useLessonPlayer();
  const { current, total } = screen.progress;

  return total === 0 ? 0 : Math.round((current / total) * 100);
}

/**
 * The full-screen task header: close, the lesson's title with its minutes under it, the screen's
 * menu, and one thin bar for the lesson. The session's progress waits for the moment between blocks.
 */
export function LessonPlayerHeader() {
  const t = useExtracted();
  const { lesson } = useLessonPlayerConfig();
  const progress = useLessonProgress();

  return (
    <TaskHeader data-slot="lesson-player-header">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LessonCloseLink />
        </TaskHeaderSide>

        <TaskHeaderTitle
          detail={t("{minutes, number} min", { minutes: lesson.estimatedMinutes })}
          title={lesson.title}
        />

        <TaskHeaderSide align="end">
          <LessonScreenMenu />
        </TaskHeaderSide>
      </TaskHeaderBar>

      <TaskHeaderProgress label={t("Lesson progress")} value={progress} />
    </TaskHeader>
  );
}
