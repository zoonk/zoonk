import { useExtracted } from "next-intl";
import { useGoalDateValues } from "../_utils/iso-date";
import { type TimeLine } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { useFinishSentence } from "./finish-sentence";
import { type GoalDate } from "./time-answer-texts";

type DatedLine = Extract<TimeLine, { kind: "pastDate" | "suggestion" }>;

type FinishLine = Extract<TimeLine, { kind: "finish" | "noFinish" }>;

const DATED_KINDS = new Set<TimeLine["kind"]>(["pastDate", "suggestion"]);
const FINISH_KINDS = new Set<TimeLine["kind"]>(["finish", "noFinish"]);

function isDatedLine(line: TimeLine): line is DatedLine {
  return DATED_KINDS.has(line.kind);
}

function isFinishLine(line: TimeLine): line is FinishLine {
  return FINISH_KINDS.has(line.kind);
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

/** A language plan ends where its aim is, so its finish says when the learner reaches it. */
function FinishWords({
  aim,
  line,
  minutes,
}: {
  aim: string | null;
  line: FinishLine;
  minutes: number | null;
}) {
  const t = useExtracted();
  const finishSentence = useFinishSentence();

  switch (line.kind) {
    case "finish":
      return finishSentence({ aim, endDate: line.endDate, minutes });
    case "noFinish":
      return t("We can't estimate an end date. Try more time or more study days.");
    default:
      return line satisfies never;
  }
}

function StatusWords({ line }: { line: Exclude<TimeLine, DatedLine | FinishLine> }) {
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

export function LineWords({
  aim = null,
  date,
  exam,
  line,
  minutes,
  subjectsTakenOut,
}: {
  aim?: string | null;
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
  subjectsTakenOut: boolean;
}) {
  if (isDatedLine(line)) {
    return (
      date && <DatedWords date={date} exam={exam} line={line} subjectsTakenOut={subjectsTakenOut} />
    );
  }

  if (isFinishLine(line)) {
    return <FinishWords aim={aim} line={line} minutes={minutes} />;
  }

  return <StatusWords line={line} />;
}
