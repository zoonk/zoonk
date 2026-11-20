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
  const dayIndex = firstParts.findIndex((part) => part.type === "day");
  const firstDay = firstParts[dayIndex];
  const secondDay = secondParts[dayIndex];

  if (
    firstDay?.type === "day" &&
    secondDay?.type === "day" &&
    firstParts.length === secondParts.length &&
    firstParts.every(
      (part, index) =>
        part.type === "day" ||
        (part.type === secondParts[index]?.type && part.value === secondParts[index]?.value),
    )
  ) {
    const nextPart = firstParts[dayIndex + 1];
    const ordinal = nextPart?.type === "literal" && nextPart.value.startsWith(". ") ? "." : "";
    const days = list.format([firstDay.value + ordinal, secondDay.value + ordinal]);

    return firstParts
      .map((part, index) => {
        if (index === dayIndex) {
          return days;
        }

        return index === dayIndex + 1 ? part.value.slice(ordinal.length) : part.value;
      })
      .join("");
  }

  const sameYear = !isInAnotherYear({ isoDate: second, today: first });

  return list.format([
    formatIsoDate({ isoDate: first, locale, today, year: sameYear ? "never" : undefined }),
    formatIsoDate({ isoDate: second, locale, today }),
  ]);
}
