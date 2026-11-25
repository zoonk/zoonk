import { type Source } from "@zoonk/db";
import { type MaterialSource } from "./material-pages";
import { hasWords } from "./source-read-status";

export const materialSourceFields = {
  contentHash: true,
  extractedText: true,
  id: true,
  mimeType: true,
  readState: true,
  title: true,
} as const;

type MaterialRow = Pick<Source, keyof typeof materialSourceFields>;

export function toReadableMaterial(sources: readonly MaterialRow[]): MaterialSource[] {
  return sources.flatMap(({ extractedText, readState, ...source }) =>
    readState !== "owed" && hasWords(extractedText) ? [{ ...source, text: extractedText }] : [],
  );
}
