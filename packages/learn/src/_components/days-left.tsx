"use client";

import { useExtracted } from "next-intl";

/**
 * The days left to a date, in the one way every screen writes them: "60 days left", and "~60 days
 * left" when the date itself is an estimate. Its words are in a namespace of their own, which
 * public pages get too (`learnSiteMessages`), since the goal menu shows there.
 */
export function useDaysLeftText() {
  const t = useExtracted("daysLeft");

  return (days: number, { estimated = false }: { estimated?: boolean } = {}): string =>
    estimated && days > 0
      ? t("{days, plural, one {~# day left} other {~# days left}}", { days })
      : t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days });
}

/** The same words, with "~" read aloud as "about". */
export function DaysLeft({ days, estimated = false }: { days: number; estimated?: boolean }) {
  const t = useExtracted("daysLeft");
  const daysLeftText = useDaysLeftText();

  if (!estimated || days <= 0) {
    return daysLeftText(days);
  }

  return (
    <>
      <span aria-hidden="true">{daysLeftText(days, { estimated })}</span>
      <span className="sr-only">
        {t("{days, plural, one {About # day left} other {About # days left}}", { days })}
      </span>
    </>
  );
}
