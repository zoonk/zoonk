import { type Source } from "@zoonk/db";
import { type SourceReadStatus } from "./source-contract";

export function hasWords(text: string | null): text is string {
  return text !== null && /[\p{L}\p{N}]/u.test(text.replaceAll(/\[illegible\]/giu, ""));
}

export function getSourceReadStatus({
  extractedText,
  readState,
}: Pick<Source, "extractedText" | "readState">): SourceReadStatus {
  if (readState === "owed") {
    return "reading";
  }

  return hasWords(extractedText) ? "readable" : "unreadable";
}

export function withSourceReadStatus<T extends Pick<Source, "extractedText" | "readState">>({
  extractedText,
  ...source
}: T) {
  return {
    ...source,
    readStatus: getSourceReadStatus({ extractedText, readState: source.readState }),
  };
}
