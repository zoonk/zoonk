import { getBaseLanguage } from "@zoonk/utils/languages";
import { replaceEmDashes } from "@zoonk/utils/string";

const NUMBER_PATTERN = /\d+/gu;

/** The translations as the model gave them: the texts' language, and the texts in each other one. */
export type PassMarkTranslationOutput = {
  language: string;
  translations: { language: string; texts: string[] }[];
};

function listNumbers(text: string): string[] {
  return text.match(NUMBER_PATTERN) ?? [];
}

/** Whether a translation keeps every number of its line, as many times as the line has it. */
function keepsNumbers({ line, translation }: { line: string; translation: string }): boolean {
  const left = listNumbers(translation);

  return listNumbers(line).every((number) => {
    const index = left.indexOf(number);

    if (index === -1) {
      return false;
    }

    left.splice(index, 1);
    return true;
  });
}

/**
 * The translations a learner can rely on, by language code: one per asked language other than the
 * texts' own, each a line for every line, in order, keeping every number its line has (a pass mark
 * with a wrong score is worse than one in another language). Em dashes are repaired; a language
 * that fails a check is left out, so its learners read the notice's own words.
 */
export function toPassMarkTranslations({
  languages,
  output,
  texts,
}: {
  languages: readonly string[];
  output: PassMarkTranslationOutput;
  texts: readonly string[];
}): Record<string, string[]> {
  const source = getBaseLanguage(output.language.trim().toLowerCase());

  const entries = output.translations.flatMap((translation) => {
    const code = getBaseLanguage(translation.language.trim().toLowerCase());
    const lines = translation.texts.map((line) => replaceEmDashes(line.trim()));

    const isUsable =
      code !== source &&
      languages.includes(code) &&
      lines.length === texts.length &&
      lines.every(
        (line, index) => line && keepsNumbers({ line: texts[index] ?? "", translation: line }),
      );

    return isUsable ? [[code, lines] as const] : [];
  });

  return Object.fromEntries(entries);
}
