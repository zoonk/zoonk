import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { normalizeString } from "@zoonk/utils/string";
import { getScreenTexts } from "./screen-texts";

const BOLD = /\*\*(?<term>[^*\n]+?)\*\*/gu;

type NewTerms = { screen: number; terms: string[] };

function readBold(screen: WrittenScreen): string[] {
  return getScreenTexts(screen).flatMap((piece) =>
    [...piece.text.matchAll(BOLD)].flatMap((match) => match.groups?.term?.trim() ?? []),
  );
}

/** A screen explains one new term; one bolded on an earlier screen is a reminder, not new. */
export function findScreensWithNewTerms(screens: readonly WrittenScreen[]): NewTerms[] {
  const seen = new Set<string>();

  return screens.flatMap((screen, index) => {
    const terms = [...new Map(readBold(screen).map((term) => [normalizeString(term), term]))];
    const fresh = terms.filter(([key]) => !seen.has(key)).map(([, term]) => term);

    for (const [key] of terms) {
      seen.add(key);
    }

    return fresh.length > 1 ? [{ screen: index, terms: fresh }] : [];
  });
}
