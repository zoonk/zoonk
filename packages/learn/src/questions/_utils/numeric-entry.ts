import { parseLocalizedNumber } from "@zoonk/utils/localized-number";

export type NumericEntry = {
  kind: "number" | "integer" | "decimals" | "fraction";
  places: number | null;
};

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
