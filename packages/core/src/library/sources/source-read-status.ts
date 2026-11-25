import { type Source } from "@zoonk/db";
import { type SourceReadStatus } from "./source-contract";

export function hasWords(text: string | null): text is string {
  return (
    text !== null &&
    /[\p{Alphabetic}\p{Decimal_Number}]/u.test(text.replaceAll(/\[illegible\]/giu, ""))
  );
}

export const sourceReadStatusFields = { hasReadableText: true, readState: true } as const;

type SourceReading = Pick<Source, keyof typeof sourceReadStatusFields>;

export function getSourceReadStatus({
  hasReadableText,
  readState,
}: SourceReading): SourceReadStatus {
  if (readState === "owed") {
    return "reading";
  }

  return hasReadableText ? "readable" : "unreadable";
}

export function withSourceReadStatus<T extends SourceReading>(source: T) {
  return { ...source, readStatus: getSourceReadStatus(source) };
}
