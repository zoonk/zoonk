"use client";

import { StatusRegion } from "@zoonk/learn/status-region";
import { TaskClose } from "@zoonk/learn/task-close";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
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
import { getChallengeProgress } from "./_utils/challenge-progress";
import { useCompletionProps } from "./completion/use-completion-props";
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

function LessonProgress() {
  const t = useExtracted();
  const { screen, state } = useLessonPlayer();
  const { current, total } = screen.progress;
  const { step } = screen;
  const label = t("Lesson progress");

  if (step?.kind === "challenge") {
    const progress = getChallengeProgress({
      answer: state.answers[step.id],
      shown: state.revealed[step.id] ?? 0,
      step,
    });

    const share = {
      deciding:
        progress.stage === "deciding" ? progress.confirmed.length / step.content.nodes.length : 0,
      ended: 1,
      intro: 0,
    }[progress.stage];

    return <TaskHeaderProgress label={label} value={Math.round(share * 100)} />;
  }

  return (
    <TaskHeaderSegments
      label={label}
      segments={screen.segments}
      value={total === 0 ? 0 : Math.round((current / total) * 100)}
    />
  );
}

export function LessonPlayerHeader() {
  const { lesson, slots } = useLessonPlayerConfig();
  const { state } = useLessonPlayer();
  const end = useCompletionProps();

  const endShowsTitle = Boolean(
    slots.completionTitled && end && end.completion.status !== "failed",
  );

  if (state.run.status === "refused" && state.run.refusal.reason === "notFound") {
    return (
      <TaskHeader>
        <TaskHeaderBar>
          <TaskHeaderSide align="start">
            <LessonClose />
          </TaskHeaderSide>
        </TaskHeaderBar>
      </TaskHeader>
    );
  }

  return (
    <TaskHeader data-slot="lesson-player-header">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LessonClose />
        </TaskHeaderSide>

        <TaskHeaderTitle spoken={endShowsTitle} title={lesson.title} />

        <TaskHeaderSide align="end">
          <UnsavedAnswers />
          <LessonScreenMenu />
        </TaskHeaderSide>
      </TaskHeaderBar>

      {state.phase !== "completed" && <LessonProgress />}
    </TaskHeader>
  );
}
