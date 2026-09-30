"use client";

import { useExtracted } from "next-intl";
import { PlayerProgressBar } from "../../components/player-progress-bar";
import { PlayerContentFrame } from "../../components/step-layouts";
import {
  type LessonPlayerSkin,
  type LessonProgressProps,
  type LessonScreenSlotProps,
} from "./lesson-player-skin";

/**
 * The lesson's title is the page's heading, with its minutes; each screen's title sits under it.
 * It's the only place the lesson is named, so it's never cut: long titles balance over two lines
 * on phones, with the minutes flowing right after the last word.
 */
function FocusHeaderCenter({
  minutes,
  title,
}: {
  minutes: number;
  progress: LessonProgressProps;
  title: string;
}) {
  const t = useExtracted();

  return (
    <div className="text-center text-sm leading-5 text-balance">
      <h1 className="text-foreground inline font-medium">{title}</h1>{" "}
      <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
        {t("{minutes, number} min", { minutes })}
      </span>
    </div>
  );
}

function FocusProgressBar({ current, total }: LessonProgressProps) {
  const value = total === 0 ? 0 : Math.min(100, Math.round((current / total) * 100));
  return <PlayerProgressBar value={value} />;
}

/**
 * Focus keeps the answered question in view with the result right under it. Reading screens
 * start at the top, like a page, instead of floating mid-screen.
 */
function FocusScreen({ feedback, question }: LessonScreenSlotProps) {
  return (
    <div
      className="my-auto flex w-full flex-col has-data-[slot=player-read-scene]:my-0"
      data-slot="focus-screen"
    >
      {question}

      {feedback && (
        <PlayerContentFrame className="flex flex-col gap-3 pb-4">
          {feedback.result}
          {feedback.notes}
        </PlayerContentFrame>
      )}
    </div>
  );
}

/** Focus: today's calm player, a thin progress bar and the result under the question. */
export const focusSkin: LessonPlayerSkin = {
  HeaderCenter: FocusHeaderCenter,
  ProgressBar: FocusProgressBar,
  Screen: FocusScreen,
  frameClassName: "bg-background",
  primaryVariant: "default",
  showsHyperdrive: false,
};
