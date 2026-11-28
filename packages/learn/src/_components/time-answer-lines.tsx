import { useExtracted } from "next-intl";
import { useGoalDateValues } from "../_utils/iso-date";
import { type TimeLine } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { type GoalDate } from "./time-answer-texts";

type DatedLine = Extract<TimeLine, { kind: "pastDate" | "suggestion" }>;

const DATED_KINDS = new Set<TimeLine["kind"]>(["pastDate", "suggestion"]);

function isDatedLine(line: TimeLine): line is DatedLine {
  return DATED_KINDS.has(line.kind);
}

/** The time a dated goal needs, which the picker can take: the same words whatever time is picked. */
function SuggestionWords({
  date,
  exam,
  line,
  subjectsTakenOut,
}: {
  date: GoalDate;
  exam: boolean;
  line: Extract<TimeLine, { kind: "suggestion" }>;
  subjectsTakenOut: boolean;
}) {
  const t = useExtracted();
  const goalDate = useGoalDateValues();
  const formatDuration = useFormatDuration();
  const time = formatDuration(line.minutes);

  if (line.focus) {
    return exam
      ? t({
          description:
            "When studying everything by the exam would take more than most people keep up: {time} is the most we suggest a day, and the plan studies what the exam asks most first.",
          message:
            "We suggest {time} a day. Your plan starts with what matters most for your exam.",
          values: { time },
        })
      : t({
          description:
            "When studying everything by the goal's date would take more than most people keep up: {time} is the most we suggest a day, and the plan studies what matters most first.",
          message:
            "We suggest {time} a day. Your plan starts with what matters most for your goal.",
          values: { time },
        });
  }

  const values = { ...goalDate(date), time };

  if (subjectsTakenOut) {
    return t({
      description:
        'When the learner took a subject out of their plan. In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "2 h".',
      message:
        "{dateKind, select, month {We suggest {time} a day to cover everything in your plan by {date}.} other {We suggest {time} a day to cover everything in your plan by {date}.}}",
      values,
    });
  }

  return exam
    ? t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "2 h".',
        message:
          "{dateKind, select, month {We suggest {time} a day to be ready for your exam by {date}.} other {We suggest {time} a day to be ready for your exam by {date}.}}",
        values,
      })
    : t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "2 h".',
        message:
          "{dateKind, select, month {We suggest {time} a day to reach your goal by {date}.} other {We suggest {time} a day to reach your goal by {date}.}}",
        values,
      });
}

function DatedWords({
  date,
  exam,
  line,
  subjectsTakenOut,
}: {
  date: GoalDate;
  exam: boolean;
  line: DatedLine;
  subjectsTakenOut: boolean;
}) {
  const t = useExtracted();
  const goalDate = useGoalDateValues();

  switch (line.kind) {
    case "suggestion":
      return (
        <SuggestionWords date={date} exam={exam} line={line} subjectsTakenOut={subjectsTakenOut} />
      );
    case "pastDate":
      return t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {Your date, {date}, has passed.} other {Your date, {date}, has passed.}}",
        values: goalDate(date),
      });
    default:
      return line satisfies never;
  }
}

function StatusWords({ line }: { line: Exclude<TimeLine, DatedLine | { kind: "finish" }> }) {
  const t = useExtracted();

  switch (line.kind) {
    case "noDays":
      return t("Choose at least one study day.");
    case "working":
      return t("Working out the time your goal needs…");
    case "findFailed":
      return t("We couldn't work out the time your goal needs.");
    case "asking":
      return t("Working out when you'd finish…");
    case "askFailed":
      return t("We couldn't work out when you'd finish.");
    default:
      return line satisfies never;
  }
}

/** No words for an undated goal's finish: it shows as a readout beside the time picked. */
export function LineWords({
  date,
  exam,
  line,
  subjectsTakenOut,
}: {
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  subjectsTakenOut: boolean;
}) {
  if (isDatedLine(line)) {
    return (
      date && <DatedWords date={date} exam={exam} line={line} subjectsTakenOut={subjectsTakenOut} />
    );
  }

  if (line.kind === "finish") {
    return null;
  }

  return <StatusWords line={line} />;
}
