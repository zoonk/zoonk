"use client";

import { type DaySplit } from "@zoonk/core/goals/daily-budget";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";
import { type TimeLine, getOffer, isBusyLine } from "../_utils/time-answer";
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

/** The time the goal needs, under the time picked, with the suggestion to take while less is picked. */
export function TimeAnswer({
  date,
  exam,
  line,
  minutes,
  onRetry,
  onUseOffer,
  split = null,
  subjectsTakenOut = false,
  updating = false,
}: {
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
  onRetry: () => void;
  onUseOffer: (minutes: number) => void;
  split?: DaySplit | null;
  subjectsTakenOut?: boolean;
  updating?: boolean;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const space = useSentenceSpace();
  const failed = FAILED_KINDS.has(line.kind);
  const offer = getOffer({ line, minutes });
  const finish = line.kind === "finish";

  if (finish && !split) {
    return null;
  }

  return (
    <p
      aria-busy={updating || isBusyLine(line)}
      aria-live="polite"
      className={cn(
        "text-muted-foreground flex flex-col gap-2 text-sm transition-opacity",
        updating && "opacity-50",
      )}
    >
      {!finish && (
        <span>
          <LineWords date={date} exam={exam} line={line} subjectsTakenOut={subjectsTakenOut} />
        </span>
      )}

      {split && (
        <>
          {!finish && space}
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
            {t({
              description:
                'A button that sets the daily study time to the one we suggest. {time} is like "2 h".',
              message: "Use {time}",
              values: { time: formatDuration(offer) },
            })}
          </Button>
        </>
      )}
    </p>
  );
}
