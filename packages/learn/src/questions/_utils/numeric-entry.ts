import { parseLocalizedNumber } from "@zoonk/utils/localized-number";

/** How a math question's answer box takes the number, as the exam's grid or box does. */
export type NumericEntry = {
  kind: "number" | "integer" | "decimals" | "fraction";
  places: number | null;
};

/** A fraction typed as "a/b", with numbers written either way ("2/3", "-1,5 / 4"). */
const FRACTION = /^(?<numerator>[^/]+)\/(?<denominator>[^/]+)$/u;

function parseFraction({ locale, text }: { locale: string; text: string }): number | null {
  const parts = FRACTION.exec(text.trim())?.groups;

  if (!parts) {
    return null;
  }

  const numerator = parseLocalizedNumber({ locale, text: parts.numerator ?? "" });
  const denominator = parseLocalizedNumber({ locale, text: parts.denominator ?? "" });

  return numerator === null || !denominator ? null : numerator / denominator;
}

/**
 * The number an answer box takes from what the learner typed, or null when it takes none: a
 * fraction box takes "2/3" as its value or a decimal, an integer box only a whole number, and every
 * other box a number with a decimal comma or point.
 */
export function parseEntryAnswer({
  entry,
  locale,
  text,
}: {
  entry: NumericEntry | null;
  locale: string;
  text: string;
}): number | null {
  if (entry?.kind === "fraction" && text.includes("/")) {
    return parseFraction({ locale, text });
  }

  const value = parseLocalizedNumber({ locale, text });

  if (entry?.kind === "integer" && value !== null && !Number.isInteger(value)) {
    return null;
  }

  return value;
}
