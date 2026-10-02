"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  type LessonPlayerSkin,
  type LessonProgressProps,
  type LessonScreenSlotProps,
} from "./lesson-player-skin";

/** Past this many screens the dots would crowd a phone header, so a counter replaces them. */
const MAX_DOTS = 20;

function dotClassName({ current, index }: { current: number; index: number }) {
  if (index < current) {
    return "bg-fun-accent-lime size-2";
  }

  if (index === current) {
    return "ring-fun-fg size-2.5 ring-2 ring-inset";
  }

  return "bg-fun-track size-2";
}

/**
 * Progress as small dots that light up, one per screen. The lesson's title stays the page's
 * heading for screen readers, as in Focus, without taking the dots' place.
 */
function FunDots({ progress, title }: { progress: LessonProgressProps; title: string }) {
  const t = useExtracted();
  const { current, total } = progress;
  const shown = String(Math.min(current + 1, total));
  const label = t("Screen {shown} of {total}", { shown, total: String(total) });

  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div
        aria-label={t("Lesson progress")}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={current}
        aria-valuetext={label}
        className="flex items-center justify-center gap-1.5"
        role="progressbar"
      >
        {total > MAX_DOTS ? (
          <span className="text-fun-fg2 font-fun-display text-xs tabular-nums">{label}</span>
        ) : (
          Array.from({ length: total }, (_, index) => (
            <span
              aria-hidden="true"
              className={cn(
                "rounded-full transition-[background-color,box-shadow] motion-reduce:transition-none",
                dotClassName({ current, index }),
              )}
              key={index}
            />
          ))
        )}
      </div>
    </>
  );
}

function FunNoProgressBar() {
  return null;
}

/** The result's verdict reads in Fun's display type on the back of the paper. */
const PAPER_CLASS =
  "fun-paper mx-auto w-full max-w-2xl rounded-[28px] [&_[data-slot=lesson-result-verdict]]:font-fun-display [&_[data-slot=lesson-result-verdict]]:text-2xl sm:[&_[data-slot=lesson-result-verdict]]:text-3xl";

/**
 * Reading happens on light paper in deep space. After an answer the paper flips to show the result
 * and the why on its back, calmly after a wrong answer. Screens that show their own result keep
 * their paper as it is.
 *
 * The buddy has its own space and never covers the paper: a row above it on phones and tablets, and
 * the free space to its left on desktop, where the paper keeps its width in the middle column. The
 * one column on phones is capped at the screen's width, so a wide canvas scrolls or shrinks inside
 * the paper instead of pushing it past the edge.
 */
function FunScreen({ companion, feedback, question }: LessonScreenSlotProps) {
  const flipped = Boolean(feedback?.result);

  return (
    <div className="my-auto grid w-full grid-cols-1 gap-2 px-3 py-3 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] lg:gap-x-4">
      {companion && (
        <div
          className="mx-auto w-full max-w-2xl lg:col-start-1 lg:row-start-1 lg:mx-0 lg:w-auto lg:justify-self-end"
          data-slot="fun-companion"
        >
          {companion}
        </div>
      )}
      <div
        className={cn(
          PAPER_CLASS,
          "lg:col-start-2 lg:row-start-1",
          flipped && "flex flex-col gap-3 p-3",
          flipped &&
            (feedback?.isCorrect
              ? "animate-fun-flip ring-fun-accent-lime ring-2"
              : "animate-fun-flip-calm"),
        )}
        data-slot="fun-paper"
      >
        {flipped ? feedback?.result : question}
        {feedback?.notes && <div className={cn(!flipped && "px-4 pb-4")}>{feedback.notes}</div>}
      </div>
    </div>
  );
}

/** Fun: deep space around a paper panel, lit dots and the flip. */
export const funSkin: LessonPlayerSkin = {
  HeaderCenter: FunDots,
  ProgressBar: FunNoProgressBar,
  Screen: FunScreen,
  frameClassName: "fun-space",
  primaryVariant: "lime",
  showsHyperdrive: true,
};
