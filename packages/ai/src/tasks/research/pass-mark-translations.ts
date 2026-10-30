import { getBaseLanguage } from "@zoonk/utils/languages";
import { replaceEmDashes } from "@zoonk/utils/string";

const NUMBER_PATTERN = /\d+/gu;

export type PassMarkTranslationOutput = {
  language: string;
  translations: { language: string; texts: string[] }[];
};

function listNumbers(text: string): string[] {
  return text.match(NUMBER_PATTERN) ?? [];
}

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
 * A pass mark with a wrong score is worse than one in another language, so a language that loses a
 * line or a number is left out and its learners read the notice's own words.
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
