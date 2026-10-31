"use client";

import { type DaySplit } from "@zoonk/core/goals/daily-budget";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatIsoDate, useGoalDateValues } from "../../_utils/iso-date";
import { useFormatShare } from "../../_utils/percent";
import { useFormatDuration } from "../../_utils/time-format";
import { useTimeToCoverTexts } from "../../plan/use-time-to-cover";
import { type FullTimeNote, type TimeLine, type TimeOffer, isBusyLine } from "./schedule-time";

export type GoalDate = { isoDate: string; namedMonth: boolean };

type DatedLine = Extract<TimeLine, { kind: "everything" | "focus" | "pastDate" | "share" }>;

type FinishLine = Extract<TimeLine, { kind: "finish" | "noFinish" }>;

const DATED_KINDS = new Set<TimeLine["kind"]>(["everything", "focus", "pastDate", "share"]);
const FINISH_KINDS = new Set<TimeLine["kind"]>(["finish", "noFinish"]);
const FAILED_KINDS = new Set<TimeLine["kind"]>(["askFailed", "findFailed"]);

function isDatedLine(line: TimeLine): line is DatedLine {
  return DATED_KINDS.has(line.kind);
}

function isFinishLine(line: TimeLine): line is FinishLine {
  return FINISH_KINDS.has(line.kind);
}

function FinishMonth(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

function EverythingTakesWords({
  date,
  note,
}: {
  date: GoalDate;
  note: Extract<FullTimeNote, { kind: "takes" }>;
}) {
  const texts = useTimeToCoverTexts();

  return (
    <p>
      {texts.everythingTakes({
        minutes: note.minutes,
        targetDate: date.isoDate,
        targetDateNamedMonth: date.namedMonth,
      })}
      {note.moreDays && <> {texts.moreDays}</>}
    </p>
  );
}

function DatedWords({
  date,
  exam,
  line,
  minutes,
}: {
  date: GoalDate;
  exam: boolean;
  line: DatedLine;
  minutes: number;
}) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const goalDate = useGoalDateValues();
  const formatShare = useFormatShare();
  const shown = goalDate({ ...date, style: "long" });

  switch (line.kind) {
    case "everything":
      if (line.suggested) {
        return exam
          ? t({
              description:
                'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
              message:
                "{dateKind, select, month {What it takes to cover all your exam topics by {date}.} other {What it takes to cover all your exam topics by {date}.}}",
              values: shown,
            })
          : t({
              description:
                'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
              message:
                "{dateKind, select, month {What it takes to cover your whole goal by {date}.} other {What it takes to cover your whole goal by {date}.}}",
              values: shown,
            });
      }

      return exam
        ? t({
            description:
              'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {Covers all your exam topics by {date}.} other {Covers all your exam topics by {date}.}}",
            values: shown,
          })
        : t({
            description:
              'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {Covers your whole goal by {date}.} other {Covers your whole goal by {date}.}}",
            values: shown,
          });
    case "focus":
      return (
        <>
          {texts.suggest(minutes)}{" "}
          {texts.focus({ coveredShare: line.coveredShare, everyTopic: line.everyTopic, exam })}
        </>
      );
    case "share":
      return exam
        ? t({
            description:
              'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {Covers about {share} of your exam topics in depth by {date}, what comes up most first.} other {Covers about {share} of your exam topics in depth by {date}, what comes up most first.}}",
            values: { ...shown, share: formatShare(line.share) },
          })
        : t({
            description:
              'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {Covers about {share} of your goal in depth by {date}, what matters most first.} other {Covers about {share} of your goal in depth by {date}, what matters most first.}}",
            values: { ...shown, share: formatShare(line.share) },
          });
    case "pastDate":
      return t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {Your date, {date}, has passed. You can choose a new one on the next screen.} other {Your date, {date}, has passed. You can choose a new one on the next screen.}}",
        values: shown,
      });
    default:
      return line satisfies never;
  }
}

function FinishWords({ line }: { line: FinishLine }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  switch (line.kind) {
    case "finish":
      return t.rich("You finish around <date>{month}</date>.", {
        date: FinishMonth,
        month: formatDate(line.endDate, "month"),
      });
    case "noFinish":
      return t(
        "We can't estimate a finish date for this schedule. Try more time or more study days.",
      );
    default:
      return line satisfies never;
  }
}

function StatusWords({
  dated,
  line,
  minutes,
}: {
  dated: boolean;
  line: Exclude<TimeLine, DatedLine | FinishLine>;
  minutes: number | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const time = formatDuration(minutes ?? 0);

  switch (line.kind) {
    case "noDays":
      return t("Choose at least one study day.");
    case "working":
      return t("Working out the time your goal needs…");
    case "findFailed":
      return t("We couldn't work out the time your goal needs.");
    case "asking":
      return dated
        ? t("Working out what {time} a day covers…", { time })
        : t("Working out when you'd finish…");
    case "askFailed":
      return dated
        ? t("We couldn't work out what {time} a day covers.", { time })
        : t("We couldn't work out when you'd finish.");
    default:
      return line satisfies never;
  }
}

function LineWords({
  date,
  exam,
  line,
  minutes,
}: {
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
}) {
  if (isDatedLine(line)) {
    return (
      date &&
      minutes !== null && <DatedWords date={date} exam={exam} line={line} minutes={minutes} />
    );
  }

  if (isFinishLine(line)) {
    return <FinishWords line={line} />;
  }

  return <StatusWords dated={date !== null} line={line} minutes={minutes} />;
}

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

  return offer.kind === "focus"
    ? t("Use the suggested {time} a day", { time })
    : t("Cover everything with {time} a day", { time });
}

/** One polite live region for the time shown: what everything takes, what this time covers, and the other time to pick. */
export function ScheduleLine({
  date,
  exam,
  line,
  minutes,
  note,
  offer,
  onRetry,
  onUseOffer,
  split,
}: {
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
  note: FullTimeNote | null;
  offer: TimeOffer | null;
  onRetry: () => void;
  onUseOffer: (minutes: number) => void;
  split: DaySplit | null;
}) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const failed = FAILED_KINDS.has(line.kind);

  return (
    <div
      aria-busy={isBusyLine(line)}
      aria-live="polite"
      className="text-muted-foreground flex min-h-12 flex-col gap-2 text-sm leading-6 text-pretty sm:min-h-0"
    >
      {date && note?.kind === "takes" && <EverythingTakesWords date={date} note={note} />}

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

        {offer && !failed && (
          <>
            {" "}
            <Button onClick={() => onUseOffer(offer.minutes)} variant="link">
              <OfferLabel offer={offer} />
            </Button>
          </>
        )}
      </p>
    </div>
  );
}
