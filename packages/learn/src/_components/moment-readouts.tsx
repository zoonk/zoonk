"use client";

import { CountUp } from "@zoonk/ui/components/count-up";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { TaskMeta } from "./task-meta";

function ReadoutNumber({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-readout inline-block text-[2.5rem]", className)}
      data-slot="readout-number"
      {...props}
    />
  );
}

function scoreNumber(chunks: React.ReactNode) {
  return <ReadoutNumber className="text-foreground">{chunks}</ReadoutNumber>;
}

function readoutWords(chunks: React.ReactNode) {
  return (
    <span className="text-muted-foreground text-sm font-medium tracking-normal">{chunks}</span>
  );
}

export function BrainPowerReadout({ delayMs, points }: { delayMs?: number; points: number }) {
  const t = useExtracted();
  const format = useFormatter();

  return t.rich("<number>+{points}</number> <words>Brain Power</words>", {
    number: () => (
      <ReadoutNumber className="text-brain-text">
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
  className,
  facts = NO_FACTS,
  score,
}: {
  brainPower: number;
  className?: string;
  facts?: readonly (string | false | null | undefined)[];
  score?: MomentScore | null;
}) {
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

      <TaskMeta facts={facts} />
    </div>
  );
}
