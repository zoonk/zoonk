"use client";

import {
  TASK_HEADER_ICON_CLASS,
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSegments,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "@zoonk/learn/task-header";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLeaveLesson } from "./lesson-leave";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonScreenMenu } from "./lesson-screen-menu";

function LessonCloseLink() {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();
  const { screen } = useLessonPlayer();
  const leave = useLeaveLesson();

  const className = cn(
    buttonVariants({ size: "icon", variant: "ghost" }),
    "shrink-0",
    TASK_HEADER_ICON_CLASS.start,
  );

  const label = (
    <>
      <XIcon aria-hidden="true" />
      <span className="sr-only">{t("Close lesson")}</span>
    </>
  );

  if (screen.unsentAnswer) {
    return (
      <button
        aria-keyshortcuts="Escape"
        className={className}
        onClick={() => leave()}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <LinkComponent aria-keyshortcuts="Escape" className={className} href={routes.exit}>
      {label}
    </LinkComponent>
  );
}

function useLessonProgress(): number {
  const { screen } = useLessonPlayer();
  const { current, total } = screen.progress;

  return total === 0 ? 0 : Math.round((current / total) * 100);
}

export function LessonPlayerHeader() {
  const t = useExtracted();
  const { lesson } = useLessonPlayerConfig();
  const { screen } = useLessonPlayer();
  const progress = useLessonProgress();

  return (
    <TaskHeader data-slot="lesson-player-header">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LessonCloseLink />
        </TaskHeaderSide>

        <TaskHeaderTitle title={lesson.title} />

        <TaskHeaderSide align="end">
          <LessonScreenMenu />
        </TaskHeaderSide>
      </TaskHeaderBar>

      <TaskHeaderSegments
        label={t("Lesson progress")}
        segments={screen.segments}
        value={progress}
      />
    </TaskHeader>
  );
}
