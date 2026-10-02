import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { normalizeString } from "@zoonk/utils/string";
import { getScreenTexts } from "./screen-texts";

/**
 * A term the writer introduced in bold ("this is called **superposition**"). Short bold words are
 * usually emphasis ("**up** the thermometer"), not terms, so they don't count.
 */
const BOLD_TERM = /\*\*(?<term>[^*]{6,60})\*\*/gu;

/** An abbreviation such as ATP, NADH or FADH2: two or more capital letters, maybe with digits. */
const ABBREVIATION =
  /(?<![\p{L}\p{N}])(?=(?:[A-Z0-9]*[A-Z]){2})[A-Z][A-Z0-9]{1,7}(?![\p{L}\p{N}])/gu;

/** Screens that introduce ideas; a term shown first anywhere else is used before it's explained. */
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

/** Abbreviations match as written; other terms ignore case and accents, and allow plurals. */
function mentions({ term, text }: { term: string; text: string }): boolean {
  if (/^[A-Z0-9]+$/u.test(term)) {
    return new RegExp(`(?<![\\p{L}\\p{N}])${term}(?![\\p{L}\\p{N}])`, "u").test(text);
  }

  const escaped = normalizeString(term).replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "u").test(normalizeString(text));
}

/**
 * Terms a lesson uses before the screen that explains them: a term the lesson introduces in bold
 * on a teaching screen, or an abbreviation a teaching screen uses, that an earlier screen (a hook,
 * a check, an option or a title) already used. The term counts as explained on the first teaching
 * screen that mentions it. Terms the lesson never explains aren't judged here; the reviewer reads
 * those.
 */
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
