"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { TaskMeta } from "./task-meta";

/**
 * A readout's number inside its words, such as a score in a result's heading: large, tabular, in
 * the text face (the app's 40px readout). The words around it stay small and muted. Its own
 * element (`data-slot="readout-number"`), so a moment's motion can move the number alone.
 */
export function ReadoutNumber({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-readout inline-block text-[2.5rem]", className)}
      data-slot="readout-number"
      {...props}
    />
  );
}

/** A score's number as a readout, in the text color. */
function scoreNumber(chunks: React.ReactNode) {
  return <ReadoutNumber className="text-foreground">{chunks}</ReadoutNumber>;
}

/** A readout's words, small and muted beside its number, whatever heading they sit in. */
function readoutWords(chunks: React.ReactNode) {
  return (
    <span className="text-muted-foreground text-sm font-medium tracking-normal">{chunks}</span>
  );
}

/**
 * Brain Power earned, the one way every celebration draws it (a task's end, the day's missions
 * bonus, the session's rewards): "+27" as a readout in its violet and "Brain Power" small beside
 * it. It reads as words, so it goes inside a heading or a line. `numberRef` reaches the number for
 * a moment that counts it up or pops it.
 */
export function BrainPowerReadout({
  numberRef,
  points,
}: {
  numberRef?: React.Ref<HTMLSpanElement>;
  points: number;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return t.rich("<number>+{points}</number> <words>Brain Power</words>", {
    number: (chunks) => (
      <ReadoutNumber className="text-brain-text" ref={numberRef}>
        {chunks}
      </ReadoutNumber>
    ),
    points: format.number(points),
    words: readoutWords,
  });
}

/** A task's end with no facts beside its readouts. */
const NO_FACTS: readonly (string | false | null | undefined)[] = [];

/**
 * What a task earned at its end (a lesson, a block of the session), as readouts: the score ("3 of 5
 * right") and the Brain Power earned in its violet, each number large beside its words, then the
 * other facts as one quiet mono line ("Review on Oct 14"). Brain Power earned is one of the few
 * louder moments. A replay earns nothing new, so "+0" never shows; with nothing to say it draws
 * nothing.
 *
 * ```tsx
 * <MomentReadouts brainPower={22} facts={["Review on Oct 14"]} score={{ answered: 5, correct: 3 }} />
 * ```
 */
export function MomentReadouts({
  brainPower,
  className,
  facts = NO_FACTS,
  score,
}: {
  brainPower: number;
  className?: string;
  facts?: readonly (string | false | null | undefined)[];
  /** Right answers of those answered; none shows when nothing was answered. */
  score?: { answered: number; correct: number } | null;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const shownScore = score && score.answered > 0 ? score : null;
  const earned = brainPower > 0;

  if (!shownScore && !earned && !facts.some(Boolean)) {
    return null;
  }

  return (
    <div className={cn("flex flex-col items-start gap-3", className)} data-slot="moment-readouts">
      {(shownScore || earned) && (
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          {shownScore && (
            <p className="text-muted-foreground text-sm font-medium" data-slot="moment-score">
              {t.rich("<number>{correct}</number> of {answered} right", {
                answered: format.number(shownScore.answered),
                correct: format.number(shownScore.correct),
                number: scoreNumber,
              })}
            </p>
          )}

          {earned && (
            <p data-slot="moment-brain-power">
              <BrainPowerReadout points={brainPower} />
            </p>
          )}
        </div>
      )}

      <TaskMeta facts={facts} />
    </div>
  );
}
