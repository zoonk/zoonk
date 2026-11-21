import { useExtracted } from "next-intl";
import { useGoalDateValues } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { type TimeLine } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";
import { useFinishSentence } from "./finish-sentence";
import { type GoalDate } from "./time-answer-texts";

type DatedLine = Extract<TimeLine, { kind: "everything" | "pastDate" | "share" }>;

type FinishLine = Extract<TimeLine, { kind: "finish" | "noFinish" }>;

const DATED_KINDS = new Set<TimeLine["kind"]>(["everything", "pastDate", "share"]);
const FINISH_KINDS = new Set<TimeLine["kind"]>(["finish", "noFinish"]);

function isDatedLine(line: TimeLine): line is DatedLine {
  return DATED_KINDS.has(line.kind);
}

function isFinishLine(line: TimeLine): line is FinishLine {
  return FINISH_KINDS.has(line.kind);
}

/**
 * Under a time picker, whose number is the sentence's subject: the first lessons it reaches, of
 * every topic or of a share that stands out.
 */
function ReachedWords({ date, exam, value }: { date: GoalDate; exam: boolean; value: number }) {
  const t = useExtracted();
  const goalDate = useGoalDateValues();
  const formatShare = useFormatShare();
  const shown = goalDate(date);

  if (value >= 1) {
    return exam
      ? t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Covers the first lessons of every exam topic by {date}.} other {Covers the first lessons of every exam topic by {date}.}}",
          values: shown,
        })
      : t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Covers the first lessons of every part of your goal by {date}.} other {Covers the first lessons of every part of your goal by {date}.}}",
          values: shown,
        });
  }

  const values = {
    ...shown,
    b: (chunks: React.ReactNode) => <strong className="font-semibold">{chunks}</strong>,
    share: formatShare(value),
  };

  return exam
    ? t.rich({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {share} is a share of the whole exam, by how much it asks, not a share of its topics.',
        message:
          "{dateKind, select, month {Covers the first lessons of about <b>{share}</b> of your exam by {date}, most-asked topics first.} other {Covers the first lessons of about <b>{share}</b> of your exam by {date}, most-asked topics first.}}",
        values,
      })
    : t.rich({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {Covers the first lessons of about <b>{share}</b> of your goal by {date}.} other {Covers the first lessons of about <b>{share}</b> of your goal by {date}.}}",
        values,
      });
}

function DatedWords({ date, exam, line }: { date: GoalDate; exam: boolean; line: DatedLine }) {
  const t = useExtracted();
  const goalDate = useGoalDateValues();
  const shown = goalDate(date);

  switch (line.kind) {
    case "everything":
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
    case "share":
      return line.share !== null && <ReachedWords date={date} exam={exam} value={line.share} />;
    case "pastDate":
      return t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {Your date, {date}, has passed.} other {Your date, {date}, has passed.}}",
        values: shown,
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
  aim = null,
  date,
  exam,
  line,
  minutes,
}: {
  aim?: string | null;
  date: GoalDate | null;
  exam: boolean;
  line: TimeLine;
  minutes: number | null;
}) {
  if (isDatedLine(line)) {
    return date && <DatedWords date={date} exam={exam} line={line} />;
  }

  if (isFinishLine(line)) {
    return <FinishWords aim={aim} line={line} minutes={minutes} />;
  }

  return <StatusWords dated={date !== null} line={line} minutes={minutes} />;
}
