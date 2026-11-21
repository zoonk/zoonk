"use client";

import { type DaySplit } from "@zoonk/core/goals/daily-budget";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";
import { type TimeLine, type TimeOffer, isBusyLine } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { LineWords } from "./time-answer-lines";
import { type GoalDate } from "./time-answer-texts";

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

function OfferLabel({ offer }: { offer: TimeOffer }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const time = formatDuration(offer.minutes);

  switch (offer.kind) {
    case "everything":
      return t("Use {time} to cover everything", { time });
    case "suggested":
      return t("Use the suggested {time}", { time });
    case "more":
      return t("Use {time} to cover more", { time });
    default:
      return offer.kind satisfies never;
  }
}

/**
 * What the time picked gets the learner: one line under the picker, whose number is its subject,
 * and at most one answer that names another time.
 */
export function TimeAnswer({
  action,
  aim = null,
  date,
  exam,
  line,
  minutes,
  offer,
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
  line: TimeLine;
  minutes: number | null;
  offer: TimeOffer | null;
  onRetry: () => void;
  onUseOffer: (minutes: number) => void;
  split?: DaySplit | null;
  updating?: boolean;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();
  const failed = FAILED_KINDS.has(line.kind);
  const offered = offer && !failed ? offer : null;

  return (
    <div className="flex min-h-15 flex-col gap-2 sm:min-h-10">
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

        {offered && (
          <>
            {space}
            <Button
              className={TIME_ANSWER_BUTTON_CLASS}
              onClick={() => onUseOffer(offered.minutes)}
              size="sm"
              variant="outline"
            >
              <OfferLabel offer={offered} />
            </Button>
          </>
        )}
      </p>

      {action}
    </div>
  );
}
