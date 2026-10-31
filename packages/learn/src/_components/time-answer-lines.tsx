import { useExtracted } from "next-intl";
import { useFormatIsoDate, useGoalDateValues } from "../_utils/iso-date";
import { type TimeLine } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { type GoalDate, useTimeAnswerTexts } from "./time-answer-texts";

type DatedLine = Extract<TimeLine, { kind: "everything" | "focus" | "pastDate" | "share" }>;

type FinishLine = Extract<TimeLine, { kind: "finish" | "noFinish" }>;

const DATED_KINDS = new Set<TimeLine["kind"]>(["everything", "focus", "pastDate", "share"]);
const FINISH_KINDS = new Set<TimeLine["kind"]>(["finish", "noFinish"]);

function isDatedLine(line: TimeLine): line is DatedLine {
  return DATED_KINDS.has(line.kind);
}

function isFinishLine(line: TimeLine): line is FinishLine {
  return FINISH_KINDS.has(line.kind);
}

function FinishMonth(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
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
  const texts = useTimeAnswerTexts();
  const goalDate = useGoalDateValues();
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
      return texts.share({ date, exam, value: line.share });
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

export function LineWords({
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
