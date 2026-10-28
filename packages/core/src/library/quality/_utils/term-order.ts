import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { normalizeString } from "@zoonk/utils/string";
import { getScreenTexts } from "./screen-texts";

const BOLD_TERM = /\*\*(?<term>[^*]{6,60})\*\*/gu;

const ABBREVIATION =
  /(?<![\p{L}\p{N}])(?=(?:[A-Z0-9]*[A-Z]){2})[A-Z][A-Z0-9]{1,7}(?![\p{L}\p{N}])/gu;

const TEACHING_KINDS = new Set<WrittenScreen["kind"]>(["explanation", "workedExample"]);

type TermUse = { introducedAt: number; term: string; usedAt: number };

function readScreenText(screen: WrittenScreen): string {
  return getScreenTexts(screen)
    .map((text) => text.text)
    .join("\n");
}

function findTerms(text: string): string[] {
  const bold = [...text.matchAll(BOLD_TERM)].flatMap((match) => match.groups?.term?.trim() ?? []);
  const abbreviations = [...text.matchAll(ABBREVIATION)].map((match) => match[0]);

  return [...bold, ...abbreviations];
}

function mentions({ term, text }: { term: string; text: string }): boolean {
  if (/^[A-Z0-9]+$/u.test(term)) {
    return new RegExp(`(?<![\\p{L}\\p{N}])${term}(?![\\p{L}\\p{N}])`, "u").test(text);
  }

  const escaped = normalizeString(term).replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "u").test(normalizeString(text));
}

export function findTermsUsedBeforeExplained(screens: readonly WrittenScreen[]): TermUse[] {
  const texts = screens.map((screen) => readScreenText(screen));

  const candidates = screens.flatMap((screen, index) =>
    TEACHING_KINDS.has(screen.kind) ? findTerms(texts[index] ?? "") : [],
  );

  const terms = [...new Map(candidates.map((term) => [normalizeString(term), term])).values()];

  return terms.flatMap((term) => {
    const introducedAt = screens.findIndex(
      (screen, index) =>
        TEACHING_KINDS.has(screen.kind) && mentions({ term, text: texts[index] ?? "" }),
    );

    const usedAt = texts.findIndex(
      (text, index) => index < introducedAt && mentions({ term, text }),
    );

    return usedAt === -1 ? [] : [{ introducedAt, term, usedAt }];
  });
}
