import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

export type GoalDate = { estimated?: boolean; isoDate: string; namedMonth: boolean };

export function useTimeAnswerTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
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
