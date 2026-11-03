import { getTotalDuration } from "@/lib/public/total-duration";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { parseCefrScore } from "@zoonk/utils/cefr";
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

const HALF_STEPS_PER_BAND = 2;

/**
 * The ladder's cells to fill, two per band from A1: a level fills through its whole band, a
 * placement to the half step it measured.
 */
export function getLadderFill(facts: Pick<CertificateFacts, "kind" | "level" | "measuredLevel">) {
  const measured = facts.kind === "placement" ? parseCefrScore(facts.measuredLevel) : null;
  const level = parseCefrScore(facts.level);

  if (measured !== null) {
    return measured * HALF_STEPS_PER_BAND + 1;
  }

  return level === null ? 0 : (level + 1) * HALF_STEPS_PER_BAND;
}
