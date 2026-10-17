import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { selectPromptVariants } from "../../_utils/prompt-variants";

/**
 * The buddy's instructions with the names the app shows in its own language only (each language's
 * in its `{{#pt}}…{{/pt}}` block): an answer never borrows another language's names, as English
 * answers did with Portuguese ones ("Hoje", "aulas") when both were in the prompt. A language the
 * app doesn't show gets none.
 */
export function selectAppLanguageNames({
  language,
  template,
}: {
  language: string;
  template: string;
}): string {
  return selectPromptVariants({
    template,
    variants: Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, locale === language])),
  });
}
