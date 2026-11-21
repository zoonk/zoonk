"use client";

import { type DaySplit } from "@zoonk/core/goals/daily-budget";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";
import { type TimeLine, getEverythingTakes, getOffer, isBusyLine } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { LineWords } from "./time-answer-lines";
import { type GoalDate, useTimeAnswerTexts } from "./time-answer-texts";

export { type GoalDate, useTimeAnswerTexts } from "./time-answer-texts";

/** An answer under the time, beside the plan's other answers: it wraps where a language runs long. */
export const TIME_ANSWER_BUTTON_CLASS =
  "text-foreground h-auto min-h-7.5 max-w-full self-start py-1 text-left whitespace-normal";

const FAILED_KINDS = new Set<TimeLine["kind"]>(["askFailed", "findFailed"]);

/** The longest sentence a dated goal's time gets, whose room every other one keeps. */
const LONGEST_LINE: TimeLine = { kind: "share", share: 0.99 };

function DaySplitWords({ split }: { split: DaySplit }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const main = formatDuration(split.mine);
  const other = formatDuration(split.rest);

  return split.others === 1
    ? t("This goal gets {main} a day and your other goal {other}.", { main, other })
    : t("This goal gets {main} a day and your other goals {other} together.", { main, other });
}

/**
 * What the time picked gets the learner: one line under the picker, whose number is its subject.
 * On a goal with a date, the line keeps the room of the longest one, and what covering everything
 * takes and the time offered to cover it keep theirs where they don't show, so nothing moves as
 * times change.
 */
export function TimeAnswer({
  action,
  aim = null,
  date,
  exam,
  found,
  line,
  minutes,
  onRetry,
  onUseOffer,
  split = null,
  updating = false,
}: {
  action?: React.ReactNode;
  /** A language goal's aim above the learner's level, which its finish is when they reach. */
  aim?: string | null;
  date: GoalDate | null;
  exam: boolean;
  /** The plan's answer for the days shown, null while it's being asked for. */
  found: PlanTimeToCover | null;
  line: TimeLine;
  minutes: number | null;
  onRetry: () => void;
  onUseOffer: (minutes: number) => void;
  split?: DaySplit | null;
  updating?: boolean;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const texts = useTimeAnswerTexts();
  const space = useSentenceSpace();
  const failed = FAILED_KINDS.has(line.kind);
  const offer = failed ? null : getOffer({ found, line, minutes });
  const full = line.kind === "share" && line.share === null ? undefined : getEverythingTakes(found);

  return (
    <div className="flex min-h-15 flex-col gap-2 sm:min-h-10">
      <p
        aria-busy={updating || isBusyLine(line)}
        aria-live="polite"
        className={cn(
          "text-muted-foreground flex flex-col gap-2 text-sm text-pretty transition-opacity",
          updating && "opacity-50",
        )}
      >
        <span className="grid">
          <span className="col-start-1 row-start-1">
            <LineWords aim={aim} date={date} exam={exam} line={line} minutes={minutes} />
          </span>

          {date && (
            <span aria-hidden className="invisible col-start-1 row-start-1">
              <LineWords date={date} exam={exam} line={LONGEST_LINE} minutes={minutes} />
            </span>
          )}
        </span>

        {full !== undefined && (
          <span className={cn(line.kind === "everything" && "invisible")}>
            {space}
            {texts.everythingTakes({ full })}
          </span>
        )}

        {split && (
          <>
            {space}
            <DaySplitWords split={split} />
          </>
        )}

        {failed && (
          <>
            {space}
            <Button
              className={TIME_ANSWER_BUTTON_CLASS}
              onClick={onRetry}
              size="sm"
              variant="outline"
            >
              {t("Try again")}
            </Button>
          </>
        )}

        {offer !== null && (
          <>
            {space}
            <Button
              className={cn(TIME_ANSWER_BUTTON_CLASS, !offer.shown && "invisible")}
              onClick={() => onUseOffer(offer.minutes)}
              size="sm"
              variant="outline"
            >
              {t("Use {time} to cover everything", { time: formatDuration(offer.minutes) })}
            </Button>
          </>
        )}
      </p>

      {action}
    </div>
  );
}
