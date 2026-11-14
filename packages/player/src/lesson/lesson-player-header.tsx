"use client";

import { StatusRegion } from "@zoonk/learn/status-region";
import { TaskClose } from "@zoonk/learn/task-close";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSegments,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "@zoonk/learn/task-header";
import { Button } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { CloudOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTutorBuddy } from "../questions/tutor-buddy";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { LessonScreenMenu } from "./lesson-screen-menu";

function LessonClose() {
  const t = useExtracted();
  const { linkComponent, routes } = useLessonPlayerConfig();
  const { screen } = useLessonPlayer();
  const { isPaused } = useLessonInteraction();
  const buddy = useTutorBuddy();

  const confirm = screen.unsentAnswer
    ? {
        cancel: t("Keep writing"),
        confirm: t("Leave"),
        description: t("Your answer hasn't been checked, so it won't be kept."),
        title: t("Leave for now?"),
      }
    : null;

  return (
    <TaskClose
      confirm={confirm}
      escHeld={isPaused || Boolean(buddy?.docked)}
      href={routes.exit}
      link={linkComponent}
    />
  );
}

function UnsavedAnswers() {
  const t = useExtracted();
  const { state } = useLessonPlayer();

  return (
    <>
      <StatusRegion className="sr-only">{state.unsavedAnswers && t("Not saved yet")}</StatusRegion>

      {state.unsavedAnswers && (
        <Popover>
          <PopoverTrigger
            render={
              <Button className="text-muted-foreground shrink-0" size="icon-bar" variant="ghost" />
            }
          >
            <CloudOffIcon aria-hidden="true" />
            <span className="sr-only">{t("Not saved yet")}</span>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-64">
            <PopoverDescription className="text-popover-foreground">
              {t("Some answers aren't saved yet. We'll keep trying while this lesson is open.")}
            </PopoverDescription>
          </PopoverContent>
        </Popover>
      )}
    </>
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
          <LessonClose />
        </TaskHeaderSide>

        <TaskHeaderTitle title={lesson.title} />

        <TaskHeaderSide align="end">
          <UnsavedAnswers />
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
