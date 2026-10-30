"use client";

import { type PlanSuggestedTime } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatGoalDate, useFormatIsoDate } from "../../_utils/iso-date";
import { useFormatShare } from "../../_utils/percent";
import { useFormatDuration } from "../../_utils/time-format";
import { type DaySplit, type TimeLine, type TooClose } from "./schedule-time";

export type GoalDate = { isoDate: string; namedMonth: boolean };

type DatedLine = Extract<TimeLine, { kind: "everyTopic" | "everything" | "pastDate" | "share" }>;

type FinishLine = Extract<TimeLine, { kind: "finish" | "noFinish" }>;

const DATED_KINDS = new Set<TimeLine["kind"]>(["everyTopic", "everything", "pastDate", "share"]);
const FINISH_KINDS = new Set<TimeLine["kind"]>(["finish", "noFinish"]);
const BUSY_KINDS = new Set<TimeLine["kind"]>(["asking", "working"]);
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

function TooCloseWords({ tooClose }: { tooClose: TooClose }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { cause, recommendedMinutes } = tooClose;
  const time = formatDuration(recommendedMinutes ?? 0);

  if (cause === "days") {
    return recommendedMinutes === null
      ? t(
          "The days you picked can't cover everything in depth by your date. More study days would help.",
        )
      : t(
          "Covering everything in depth by your date takes {time} a day on the days you picked. More study days bring that down.",
          { time },
        );
  }

  return recommendedMinutes === null
    ? t("Your date is too close to cover everything in depth.")
    : t("Your date is close: covering everything in depth takes {time} a day.", { time });
}

function DatedWords({ date, exam, line }: { date: GoalDate; exam: boolean; line: DatedLine }) {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();
  const formatShare = useFormatShare();
  const shown = formatGoalDate({ ...date, style: "long" });

  switch (line.kind) {
    case "everything":
      if (line.suggested) {
        return exam
          ? t("What it takes to cover all your exam topics by {date}.", { date: shown })
          : t("What it takes to cover your whole goal by {date}.", { date: shown });
      }

      return exam
        ? t("Covers all your exam topics by {date}.", { date: shown })
        : t("Covers your whole goal by {date}.", { date: shown });
    case "everyTopic":
      return exam
        ? t("Reaches every exam topic by {date}, some in less depth.", { date: shown })
        : t("Reaches every part of your goal by {date}, some in less depth.", { date: shown });
    case "share":
      return exam
        ? t(
            "Covers about {share} of your exam topics in depth by {date}, what comes up most first.",
            { date: shown, share: formatShare(line.share) },
          )
        : t("Covers about {share} of your goal in depth by {date}, what matters most first.", {
            date: shown,
            share: formatShare(line.share),
          });
    case "pastDate":
      return t("Your date, {date}, has passed. You can choose a new one on the next screen.", {
        date: shown,
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
    return date && <DatedWords date={date} exam={exam} line={line} />;
  }

  if (isFinishLine(line)) {
    return <FinishWords line={line} />;
  }

  return <StatusWords dated={date !== null} line={line} minutes={minutes} />;
}

function DaySplitWords({ split }: { split: DaySplit }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const main = formatDuration(split.main);
  const other = formatDuration(split.other);

  return split.others === 1
    ? t("This goal gets {main} a day and your other goal {other}.", { main, other })
    : t("This goal gets {main} a day and each of your other goals {other}.", { main, other });
}

function OfferLabel({ offer }: { offer: PlanSuggestedTime }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const time = formatDuration(offer.minutes);

  return offer.kind === "everything"
    ? t("Cover everything with {time} a day", { time })
    : t("Reach every topic with {time} a day", { time });
}

/** One polite live region for the time shown: what it means, why, and the way back to the suggestion. */
export function ScheduleLine({
  date,
  exam,
  line,
  minutes,
  offer,
  onRetry,
  onUseOffer,
  split,
  tooClose,
}: {
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
  offer: PlanSuggestedTime | null;
  onRetry: () => void;
  onUseOffer: (minutes: number) => void;
  split: DaySplit | null;
  tooClose: TooClose | null;
}) {
  const t = useExtracted();
  const failed = FAILED_KINDS.has(line.kind);

  return (
    <p
      aria-busy={BUSY_KINDS.has(line.kind)}
      aria-live="polite"
      className="text-muted-foreground min-h-12 text-sm leading-6 text-pretty sm:min-h-0"
    >
      {tooClose && (
        <>
          <TooCloseWords tooClose={tooClose} />{" "}
        </>
      )}

      <LineWords date={date} exam={exam} line={line} minutes={minutes} />

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
  );
}
