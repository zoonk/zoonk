import { isInAnotherYear } from "@zoonk/utils/calendar-day";
import { formatIsoDate, getIsoDateParts } from "@zoonk/utils/date-format";
import { getFormattingLocale } from "@zoonk/utils/locale";

export function formatExamDayList({
  dates: [first, second],
  locale,
  today,
}: {
  dates: readonly [string, string];
  locale: string;
  today: string;
}): string {
  const list = new Intl.ListFormat(getFormattingLocale(locale), { type: "conjunction" });
  const firstParts = getIsoDateParts({ isoDate: first, locale, today });
  const secondParts = getIsoDateParts({ isoDate: second, locale, today });
  const firstDay = firstParts.find((part) => part.type === "day");
  const secondDay = secondParts.find((part) => part.type === "day");

  if (
    firstDay &&
    secondDay &&
    firstParts.length === secondParts.length &&
    firstParts.every(
      (part, index) =>
        part.type === "day" ||
        (part.type === secondParts[index]?.type && part.value === secondParts[index]?.value),
    )
  ) {
    const days = list.format([firstDay.value, secondDay.value]);
    return firstParts.map((part) => (part.type === "day" ? days : part.value)).join("");
  }

  const sameYear = !isInAnotherYear({ isoDate: second, today: first });

  return list.format([
    formatIsoDate({ isoDate: first, locale, today, year: sameYear ? "never" : undefined }),
    formatIsoDate({ isoDate: second, locale, today }),
  ]);
}
