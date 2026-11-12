"use client";

import { CountUp } from "@zoonk/ui/components/count-up";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useEffect, useState } from "react";
import { deviceStorage } from "../_utils/device-storage";
import { TaskMeta } from "./task-meta";

/** Under a moment's title, so the title leads. */
const LINE_SIZE = "text-2xl";

/** Where the number is the moment itself: the day's bonus, the day's total. */
const HERO_SIZE = "text-[2.5rem]";

const INTRO_KEY = "zoonk:brain-power-intro";

/** Brain Power says what it is the first few times a learner earns it on this device. */
const INTRO_TIMES = 1;

function readIntroCount(): number {
  return Number(deviceStorage.get(INTRO_KEY)) || 0;
}

/**
 * Decided once per moment, when the learner's action opened it, so the line never leaves a moment
 * it was drawn on.
 */
function useBrainPowerIntro(earned: boolean): boolean {
  const fresh = useCelebration();
  // oxlint-disable-next-line react/hook-use-state -- Read once as the moment opens, never updated.
  const [shown] = useState(() => fresh && earned && readIntroCount() < INTRO_TIMES);

  useEffect(() => {
    if (shown) {
      deviceStorage.set(INTRO_KEY, String(readIntroCount() + 1));
    }
  }, [shown]);

  return shown;
}

function ReadoutNumber({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-readout inline-block", className)}
      data-slot="readout-number"
      {...props}
    />
  );
}

function scoreNumber(chunks: React.ReactNode) {
  return <ReadoutNumber className={cn("text-foreground", LINE_SIZE)}>{chunks}</ReadoutNumber>;
}

function readoutWords(chunks: React.ReactNode) {
  return (
    <span className="text-muted-foreground text-sm font-medium tracking-normal">{chunks}</span>
  );
}

export function BrainPowerReadout({
  delayMs,
  hero = false,
  points,
}: {
  delayMs?: number;
  hero?: boolean;
  points: number;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return t.rich("<number>+{points}</number> <words>Brain Power</words>", {
    number: () => (
      <ReadoutNumber className={cn("text-brain-text", hero ? HERO_SIZE : LINE_SIZE)}>
        <CountUp delayMs={delayMs} format={(value) => `+${format.number(value)}`} value={points} />
      </ReadoutNumber>
    ),
    points: format.number(points),
    words: readoutWords,
  });
}

type MomentScore = { answered: number; correct: number; spoken?: boolean };

function ScoreWords({ score }: { score: MomentScore }) {
  const t = useExtracted();
  const format = useFormatter();

  const scoreValues = {
    answered: format.number(score.answered),
    correct: score.correct,
    number: scoreNumber,
  };

  return score.spoken
    ? t.rich({
        description: "Counts words the learner said aloud in pronunciation practice.",
        message:
          "{correct, plural, =0 {<number>#</number> of {answered} sounded right} one {<number>#</number> of {answered} sounded right} other {<number>#</number> of {answered} sounded right}}",
        // next-intl's extractor drops a shorthand `values` (https://github.com/amannn/next-intl/issues/2444), so keep this a key-value property.
        values: scoreValues,
      })
    : t.rich(
        "{correct, plural, =0 {<number>#</number> of {answered} right} one {<number>#</number> of {answered} right} other {<number>#</number> of {answered} right}}",
        scoreValues,
      );
}

const NO_FACTS: readonly (string | false | null | undefined)[] = [];

export function MomentReadouts({
  brainPower,
  children,
  className,
  facts = NO_FACTS,
  score,
}: {
  brainPower: number;
  children?: React.ReactNode;
  className?: string;
  facts?: readonly (string | false | null | undefined)[];
  score?: MomentScore | null;
}) {
  const t = useExtracted();
  const shownScore = score && score.answered > 0 ? score : null;
  const earned = brainPower > 0;
  const intro = useBrainPowerIntro(earned);

  if (!shownScore && !earned && !facts.some(Boolean) && !children) {
    return null;
  }

  return (
    <div className={cn("flex flex-col items-start gap-3", className)} data-slot="moment-readouts">
      {(shownScore || earned) && (
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          {shownScore && (
            <p className="text-muted-foreground text-sm font-medium" data-slot="moment-score">
              <ScoreWords score={shownScore} />
            </p>
          )}

          {earned && (
            <p data-slot="moment-brain-power">
              <BrainPowerReadout points={brainPower} />
            </p>
          )}
        </div>
      )}

      {intro && (
        <p className="text-muted-foreground -mt-1.5 text-sm" data-slot="brain-power-intro">
          {t("Points for what you learn.")}
        </p>
      )}

      <TaskMeta facts={facts} />
      {children}
    </div>
  );
}
