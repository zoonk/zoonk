import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { fillPromptLanguages } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";

/**
 * Names the answer's language and keeps only that language's app names, so it never borrows
 * another's: English answers used "Hoje" and "aulas" when both were in the prompt, and told only to
 * match the message's language, a Portuguese learner got Spanish for a message that quoted Italian.
 * The variety's rules stay only for a learner who chose a country.
 */
export function selectTutorLanguage({
  language,
  template,
  variety,
}: {
  language: string;
  template: string;
  variety: boolean;
}): string {
  const locales = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, locale === language]),
  );

  const selected = selectPromptVariants({ template, variants: { ...locales, variety } });

  return fillPromptLanguages({ learnerLanguage: language, template: selected });
}
