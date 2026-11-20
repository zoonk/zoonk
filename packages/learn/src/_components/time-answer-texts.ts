import { useExtracted } from "next-intl";
import { useGoalDateValues } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { type FullTime } from "../_utils/time-answer";
import { useFormatDuration } from "../_utils/time-format";

export type GoalDate = { estimated?: boolean; isoDate: string; namedMonth: boolean };

export function useTimeAnswerTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();
  const goalDate = useGoalDateValues();

  /**
   * What covering everything takes, said as a fact beside a suggestion that doesn't cover it.
   * Without `date`, for a sentence above that already names it.
   */
  const everythingTakes = ({ date, full }: { date?: GoalDate; full: FullTime | null }) => {
    if (!full) {
      return date
        ? t({
            description:
              'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {There isn't enough time to cover everything by {date}.} other {There isn't enough time to cover everything by {date}.}}",
            values: goalDate(date),
          })
        : t("There isn't enough time to cover everything.");
    }

    const time = formatDuration(full.minutes);

    return full.everything
      ? t("Covering everything takes about {time} a day.", { time })
      : t("The most you can cover is about {share}, at {time} a day.", {
          share: formatShare(full.coveredShare),
          time,
        });
  };

  /** What the time reaches, where no picker shows it: the first lessons of every topic or of a share. */
  const timeCovers = ({
    exam,
    minutes,
    value,
  }: {
    exam: boolean;
    minutes: number;
    value: number;
  }) => {
    const time = formatDuration(minutes);

    if (value >= 1) {
      return exam
        ? t("{time} a day covers the first lessons of every exam topic", { time })
        : t("{time} a day covers the first lessons of every part of your goal", { time });
    }

    const values = { share: formatShare(value), time };

    return exam
      ? t(
          "{time} a day covers the first lessons of about {share} of your exam, most-asked topics first",
          values,
        )
      : t("{time} a day covers the first lessons of about {share} of your goal", values);
  };

  return {
    everythingTakes,
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
