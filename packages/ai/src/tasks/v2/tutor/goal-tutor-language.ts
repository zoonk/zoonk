import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { selectPromptVariants } from "../../_utils/prompt-variants";

/**
 * Only the answer's language's names, so it never borrows another's: English answers used "Hoje"
 * and "aulas" when both were in the prompt.
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
