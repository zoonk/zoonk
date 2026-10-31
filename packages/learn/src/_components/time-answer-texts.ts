import { useExtracted } from "next-intl";
import { useGoalDateValues } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { type FullTime } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";

export type GoalDate = { isoDate: string; namedMonth: boolean };

export function useTimeAnswerTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();
  const goalDate = useGoalDateValues();

  const everythingTakes = ({ date, full }: { date: GoalDate; full: FullTime | null }) => {
    const dateValues = goalDate({ ...date, style: "long" });

    if (!full) {
      return t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {Not even a whole day covers everything in depth by {date}.} other {Not even a whole day covers everything in depth by {date}.}}",
        values: dateValues,
      });
    }

    const time = formatDuration(full.minutes);

    return full.coveredShare >= 1
      ? t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "13 h 30 min".',
          message:
            "{dateKind, select, month {Covering everything in depth by {date} takes about {time} a day, more than most people can keep up.} other {Covering everything in depth by {date} takes about {time} a day, more than most people can keep up.}}",
          values: { ...dateValues, time },
        })
      : t({
          description:
            'Part of the goal never fits, whatever the time, so this is the most any daily time covers. In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "8 h"; {share} a percentage, like "99%".',
          message:
            "{dateKind, select, month {Covering as much as any daily time can by {date}, about {share} in depth, takes about {time} a day, more than most people can keep up.} other {Covering as much as any daily time can by {date}, about {share} in depth, takes about {time} a day, more than most people can keep up.}}",
          values: { ...dateValues, share: formatShare(full.coveredShare), time },
        });
  };

  const share = ({ date, exam, value }: { date: GoalDate; exam: boolean; value: number }) => {
    const shareValues = { ...goalDate({ ...date, style: "long" }), share: formatShare(value) };

    return exam
      ? t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Covers about {share} of your exam topics in depth by {date}, starting with what comes up most.} other {Covers about {share} of your exam topics in depth by {date}, starting with what comes up most.}}",
          values: shareValues,
        })
      : t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Covers about {share} of your goal in depth by {date}, starting with what matters most.} other {Covers about {share} of your goal in depth by {date}, starting with what matters most.}}",
          values: shareValues,
        });
  };

  const focus = ({
    coveredShare,
    everyTopic,
    exam,
  }: {
    coveredShare: number;
    everyTopic: boolean;
    exam: boolean;
  }) => {
    const shareValues = { share: formatShare(coveredShare) };

    if (exam) {
      return everyTopic
        ? t({
            description:
              '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
            message:
              "Your plan then covers every exam topic, the ones asked most in more depth. That's about {share} of the exam studied in depth.",
            values: shareValues,
          })
        : t({
            description:
              '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
            message:
              "Your plan then starts with what the exam asks most, about {share} of it studied in depth. Topics it asks least may not fit.",
            values: shareValues,
          });
    }

    return everyTopic
      ? t({
          description:
            '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
          message:
            "Your plan then covers every part of your goal, what matters most in more depth. That's about {share} of it studied in depth.",
          values: shareValues,
        })
      : t({
          description:
            '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
          message:
            "Your plan then starts with what matters most, about {share} of your goal studied in depth. The rest may not fit.",
          values: shareValues,
        });
  };

  return {
    everythingTakes,
    focus,
    moreDays: t("More study days would help."),
    share,
    suggest: (minutes: number) =>
      t({
        description:
          'A sentence before what that time covers. {time} is a daily study time, like "4 h".',
        message: "We suggest {time} a day.",
        values: { time: formatDuration(minutes) },
      }),
    suggestTitle: (minutes: number) =>
      t({
        description:
          'The title of a suggestion to change the daily study time. {time} is like "4 h".',
        message: "We suggest {time} a day",
        values: { time: formatDuration(minutes) },
      }),
    tooLong: t("That's more than most people can keep up."),
  };
}
