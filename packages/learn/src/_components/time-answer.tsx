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

function DaySplitWords({ split }: { split: DaySplit }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const main = formatDuration(split.mine);
  const other = formatDuration(split.rest);

  return split.others === 1
    ? t("This goal gets {main} a day and your other goal {other}.", { main, other })
    : t("This goal gets {main} a day and your other goals {other} together.", { main, other });
}

/** What the time and days picked get the learner, whose number is its subject. */
export function TimeAnswer({
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

  const full =
    line.kind === "everything" || (line.kind === "share" && line.share === null)
      ? undefined
      : getEverythingTakes(found);

  return (
    <p
      aria-busy={updating || isBusyLine(line)}
      aria-live="polite"
      className={cn(
        "text-muted-foreground flex flex-col gap-2 text-sm transition-opacity",
        updating && "opacity-50",
      )}
    >
      <span>
        <LineWords aim={aim} date={date} exam={exam} line={line} minutes={minutes} />
      </span>

      {full !== undefined && (
        <span>
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
            className={TIME_ANSWER_BUTTON_CLASS}
            onClick={() => onUseOffer(offer)}
            size="sm"
            variant="outline"
          >
            {t("Use {time} to cover everything", { time: formatDuration(offer) })}
          </Button>
        </>
      )}
    </p>
  );
}
