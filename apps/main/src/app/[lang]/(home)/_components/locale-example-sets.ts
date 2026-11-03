import { type SupportedLocale } from "@zoonk/utils/locale";
import { type ExampleSet } from "./example-set";
import { de } from "./example-sets/de";
import { en } from "./example-sets/en";
import { es } from "./example-sets/es";
import { fr } from "./example-sets/fr";
import { it } from "./example-sets/it";
import { ja } from "./example-sets/ja";
import { ko } from "./example-sets/ko";
import { pl } from "./example-sets/pl";
import { pt } from "./example-sets/pt";
import { tr } from "./example-sets/tr";

const EXAMPLE_SETS: Record<SupportedLocale, ExampleSet> = {
  de,
  en,
  es,
  fr,
  it,
  ja,
  ko,
  pl,
  pt,
  tr,
};

/** Takes the locale, so the Open Graph image, which can't read root params, uses it too. */
export function getLocaleExampleSet(locale: SupportedLocale): ExampleSet {
  return EXAMPLE_SETS[locale];
}
