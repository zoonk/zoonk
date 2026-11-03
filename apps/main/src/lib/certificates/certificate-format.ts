import { getTotalDuration } from "@/lib/public/total-duration";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { formatDuration } from "@zoonk/utils/duration";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { getNumberFormatter } from "@zoonk/utils/localized-number";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MAX_TOPICS = 6;

/** `completedOn` is the learner's own day, so it's read at UTC midnight and no time zone moves it. */
export function formatCertificateDate({
  isoDate,
  locale,
}: {
  isoDate: string;
  locale: string;
}): string {
  return new Intl.DateTimeFormat(getFormattingLocale(locale), {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** The plan's estimate, rounded the way the catalog rounds course lengths: whole hours past one. */
export function formatStudyTime({ locale, minutes }: { locale: string; minutes: number }): string {
  const duration = getTotalDuration(Math.round(minutes));
  const roundedMinutes = "hours" in duration ? duration.hours * MINUTES_PER_HOUR : duration.minutes;

  return formatDuration({ locale, totalSeconds: roundedMinutes * SECONDS_PER_MINUTE });
}

/** The post's study stat as a big number and a small unit: "~41" and "h". */
export function getStudyTimeStat({ locale, minutes }: { locale: string; minutes: number }): {
  unit: string;
  value: string;
} {
  const duration = getTotalDuration(Math.round(minutes));
  const unit = "hours" in duration ? "hour" : "minute";
  const value = "hours" in duration ? duration.hours : duration.minutes;

  const parts = getNumberFormatter(locale, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
  }).formatToParts(value);

  return {
    unit: parts
      .filter((part) => part.type === "unit")
      .map((part) => part.value)
      .join(""),
    value: `~${parts
      .filter((part) => part.type !== "unit" && part.type !== "literal")
      .map((part) => part.value)
      .join("")}`,
  };
}

export function formatCount({ count, locale }: { count: number; locale: string }): string {
  return getNumberFormatter(locale, {}).format(count);
}

export function getShownTopics(topics: readonly string[]): { hidden: number; shown: string[] } {
  return { hidden: Math.max(0, topics.length - MAX_TOPICS), shown: topics.slice(0, MAX_TOPICS) };
}

/** The ladder's half steps from A1 up: two per band to C1, one for C2. */
const LADDER_STEPS = ["A1", "A1+", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C1+", "C2"];

/** A level fills through its whole band; a placement fills to the half step it measured. */
export function getLadderFill(facts: Pick<CertificateFacts, "kind" | "level" | "measuredLevel">) {
  if (facts.kind === "placement" && facts.measuredLevel) {
    return LADDER_STEPS.indexOf(facts.measuredLevel) + 1;
  }

  return facts.level ? LADDER_STEPS.indexOf(`${facts.level}+`) + 1 : 0;
}
