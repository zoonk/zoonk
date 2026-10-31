import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

/** An imperative reads as an order to the learner, so each language words abilities in its learning goals' form. */
const VERB_FORMS: Record<SupportedLocale, string> = {
  de: "an infinitive phrase with the verb at the end, as German learning goals are written",
  en: "the verb's base form at the start",
  es: "the infinitive at the start",
  fr: "the infinitive at the start",
  it: "the infinitive at the start",
  ja: "a phrase ending in the verb's plain potential form (直せる, 読める, ～できる), as Japanese course pages list what you'll be able to do",
  ko: "a phrase ending in ~ㄹ 수 있어요 (고칠 수 있어요), as Korean learning apps say what you'll be able to do",
  pl: 'the infinitive at the start, imperfective for a skill ("rozwiązywać równania") and perfective only for a one-time result ("napisać CV")',
  pt: "the infinitive at the start",
  tr: 'a verb-final phrase ending in the -mak/-mek infinitive ("grafikleri yorumlamak")',
};

export function getVerbForm(language: string): string {
  return VERB_FORMS[getSupportedLocaleFromLanguage(language)];
}
