import { useExtracted } from "next-intl";
import { useGoalDateValues } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";

export type GoalDate = { estimated?: boolean; isoDate: string; namedMonth: boolean };

export function useTimeAnswerTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const goalDate = useGoalDateValues();

  return {
    /** Where the time suggested studies everything by the date: the line under its title. */
    enoughBy: ({ date, exam }: { date: GoalDate; exam: boolean }) =>
      exam
        ? t({
            description:
              'Said under "We suggest {time} a day". In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {That's enough to be ready for your exam by {date}.} other {That's enough to be ready for your exam by {date}.}}",
            values: goalDate(date),
          })
        : t({
            description:
              'Said under "We suggest {time} a day". In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
            message:
              "{dateKind, select, month {That's enough to reach your goal by {date}.} other {That's enough to reach your goal by {date}.}}",
            values: goalDate(date),
          }),
    /** Where the plan's time doesn't study everything by the date, said without a share. */
    startsWithMost: (exam: boolean) =>
      exam
        ? t("Your plan starts with what matters most for your exam.")
        : t("Your plan starts with what matters most for your goal."),
    suggestTitle: (minutes: number) =>
      t({
        description:
          'The title of a suggestion to change the daily study time. {time} is like "4 h".',
        message: "We suggest {time} a day",
        values: { time: formatDuration(minutes) },
      }),
  };
}
