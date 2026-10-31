"use client";

import { type DaySplit } from "@zoonk/core/goals/daily-budget";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  type FullTimeNote,
  type TimeLine,
  type TimeOffer,
  isBusyLine,
} from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { LineWords } from "./time-answer-lines";
import { type GoalDate, useTimeAnswerTexts } from "./time-answer-texts";

export { type GoalDate, useTimeAnswerTexts } from "./time-answer-texts";

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
      return t("Use {time} a day to cover everything", { time });
    case "focus":
      return t("Use the suggested {time} a day", { time });
    case "full":
      return t({
        description: "A button that changes the plan's daily time to the one just found.",
        message: "Use {time} a day",
        values: { time },
      });
    default:
      return offer.kind satisfies never;
  }
}

function OfferAction({
  offer,
  offerAs,
  onUseOffer,
}: {
  offer: TimeOffer;
  offerAs: "button" | "link";
  onUseOffer: (minutes: number) => void;
}) {
  return offerAs === "link" ? (
    <Button onClick={() => onUseOffer(offer.minutes)} variant="link">
      <OfferLabel offer={offer} />
    </Button>
  ) : (
    <Button
      className="text-foreground self-start"
      onClick={() => onUseOffer(offer.minutes)}
      size="sm"
      variant="outline"
    >
      <OfferLabel offer={offer} />
    </Button>
  );
}

function NoteWords({
  date,
  note,
  noteStatus,
}: {
  date: GoalDate | null;
  note: FullTimeNote | null;
  noteStatus: "failed" | "finding" | null;
}) {
  const t = useExtracted();
  const texts = useTimeAnswerTexts();

  if (date && note?.kind === "takes") {
    return (
      <p>
        {texts.everythingTakes({ date, full: note.full })}
        {note.moreDays && <> {texts.moreDays}</>}
      </p>
    );
  }

  if (noteStatus === "finding") {
    return <p>{t("Working out the time your goal needs…")}</p>;
  }

  return noteStatus === "failed" ? (
    <p>{t("We couldn't work out the time your goal needs.")}</p>
  ) : null;
}

export function TimeAnswer({
  date,
  exam,
  line,
  minutes,
  note,
  noteStatus = null,
  offer,
  offerAs = "link",
  onRetry,
  onUseOffer,
  split = null,
  updating = false,
}: {
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
  note: FullTimeNote | null;
  noteStatus?: "failed" | "finding" | null;
  offer: TimeOffer | null;
  offerAs?: "button" | "link";
  onRetry: () => void;
  onUseOffer: (minutes: number) => void;
  split?: DaySplit | null;
  updating?: boolean;
}) {
  const t = useExtracted();
  const texts = useTimeAnswerTexts();
  const failed = FAILED_KINDS.has(line.kind) || noteStatus === "failed";
  const offered = offer && !failed ? offer : null;

  return (
    <div
      aria-busy={updating || isBusyLine(line) || noteStatus === "finding"}
      aria-live="polite"
      className={cn(
        "text-muted-foreground flex min-h-12 flex-col gap-2 text-sm leading-6 text-pretty transition-opacity sm:min-h-0",
        updating && "opacity-50",
      )}
    >
      <NoteWords date={date} note={note} noteStatus={noteStatus} />

      <p>
        <LineWords date={date} exam={exam} line={line} minutes={minutes} />

        {note?.kind === "tooLong" && <> {texts.tooLong}</>}

        {split && (
          <>
            {" "}
            <DaySplitWords split={split} />
          </>
        )}

        {failed && (
          <>
            {" "}
            <Button onClick={onRetry} variant="link">
              {t("Try again")}
            </Button>
          </>
        )}

        {offered && offerAs === "link" && (
          <>
            {" "}
            <OfferAction offer={offered} offerAs={offerAs} onUseOffer={onUseOffer} />
          </>
        )}
      </p>

      {offered && offerAs === "button" && (
        <OfferAction offer={offered} offerAs={offerAs} onUseOffer={onUseOffer} />
      )}
    </div>
  );
}
