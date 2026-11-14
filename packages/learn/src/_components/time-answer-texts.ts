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

  /** For a card with no picker above it, where nothing else says how long everything takes. */
  const everythingTakes = ({ date, full }: { date: GoalDate; full: FullTime | null }) => {
    if (!full) {
      return t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {No time a day covers everything by {date}.} other {No time a day covers everything by {date}.}}",
        values: goalDate({ ...date, style: "long" }),
      });
    }

    const time = formatDuration(full.minutes);

    return full.everything
      ? t("Covering everything takes about {time} a day.", { time })
      : t("The most any time covers is about {share}, at {time} a day.", {
          share: formatShare(full.coveredShare),
          time,
        });
  };

  /** Under a time picker, whose number is the sentence's subject. */
  const share = ({ date, exam, value }: { date: GoalDate; exam: boolean; value: number }) => {
    const shareValues = { ...goalDate({ ...date, style: "long" }), share: formatShare(value) };

    return exam
      ? t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Covers about {share} of your exam topics by {date}.} other {Covers about {share} of your exam topics by {date}.}}",
          values: shareValues,
        })
      : t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Covers about {share} of your goal by {date}.} other {Covers about {share} of your goal by {date}.}}",
          values: shareValues,
        });
  };

  /** The same fact where no picker shows the time. */
  const timeCovers = ({
    exam,
    minutes,
    value,
  }: {
    exam: boolean;
    minutes: number;
    value: number;
  }) => {
    const values = { share: formatShare(value), time: formatDuration(minutes) };

    return exam
      ? t("{time} a day covers about {share} of your exam topics", values)
      : t("{time} a day covers about {share} of your goal", values);
  };

  return {
    everythingTakes,
    share,
    suggestTitle: (minutes: number) =>
      t({
        description:
          'The title of a suggestion to change the daily study time. {time} is like "4 h".',
        message: "We suggest {time} a day",
        values: { time: formatDuration(minutes) },
      }),
    timeCovers,
  };
}
