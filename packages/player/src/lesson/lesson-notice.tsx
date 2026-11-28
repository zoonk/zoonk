"use client";

import { Eyebrow } from "@zoonk/learn/eyebrow";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CloudOffIcon, ImageIcon, MicOffIcon, PenOffIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "../components/step-layouts";
import { focusLessonAfterTurn } from "./_utils/lesson-focus";
import { useLessonPlayer } from "./lesson-player-context";

function NoticeLine({
  action,
  children,
  icon,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <PlayerContentFrame className="flex items-center justify-between gap-3 pt-4">
      <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
        <LineMarker>{icon}</LineMarker>
        {children}
      </p>
      {action}
    </PlayerContentFrame>
  );
}

function TurnBackOnButton() {
  const t = useExtracted();
  const { actions, state } = useLessonPlayer();

  if (!state.skipRestore || state.phase !== "playing") {
    return null;
  }

  return (
    <Button
      edge="end"
      onClick={() => {
        actions.restoreSkipped();
        focusLessonAfterTurn();
      }}
      size="sm"
      variant="ghost"
    >
      {t("Turn back on")}
    </Button>
  );
}

export function LessonNotice() {
  const t = useExtracted();
  const { screen, state } = useLessonPlayer();

  if (screen.quickCheck) {
    return (
      <PlayerContentFrame className="pt-4">
        <Eyebrow icon={<ZapIcon aria-hidden="true" />}>
          {t("Quick check · {current} of {total}", {
            current: String(screen.quickCheck.current + 1),
            total: String(screen.quickCheck.total),
          })}
        </Eyebrow>
      </PlayerContentFrame>
    );
  }

  switch (state.notice) {
    case "selfCorrect":
      // Drawn with what the check adds (`CheckAdditions`), so nothing above the answer moves.
      return null;
    case "answerNotSaved":
      return (
        <NoticeLine icon={<CloudOffIcon aria-hidden="true" className="size-4" />}>
          {t("Your answer here didn't save. Answer it again to finish the lesson.")}
        </NoticeLine>
      );
    case "pictureReady":
      return (
        <NoticeLine icon={<ImageIcon aria-hidden="true" className="size-4" />}>
          {t("This question was waiting for its picture. Answer it to finish the lesson.")}
        </NoticeLine>
      );
    case "speakingSkipped":
    case "writingSkipped": {
      const Icon = state.notice === "writingSkipped" ? PenOffIcon : MicOffIcon;

      return (
        <NoticeLine
          action={<TurnBackOnButton />}
          icon={<Icon aria-hidden="true" className="size-4" />}
        >
          {state.notice === "writingSkipped"
            ? t("Writing is off for today.")
            : t({
                description:
                  'Shown after the learner chose "I can\'t talk now": the lesson\'s questions answered out loud are off until tomorrow. Word it like its twin "Writing is off for today." (shown after "Can\'t write now"), naming the spoken questions the way that line names the written ones.',
                message: "Speaking is off for today.",
              })}
        </NoticeLine>
      );
    }
    case null:
      return null;
    default:
      return state.notice satisfies never;
  }
}
