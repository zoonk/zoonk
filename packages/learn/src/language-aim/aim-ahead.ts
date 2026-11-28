import { type LanguageAimView } from "@zoonk/core/language/aims";

/**
 * The aim as the plan names it ("B1+"), only while it's among its choices, so a learner past their
 * aim isn't told when they'll reach it.
 */
export function getAimAhead(languageAim: LanguageAimView | null): string | null {
  const ahead = languageAim?.choices.some((choice) => choice.aim === languageAim.aim);
  return ahead ? (languageAim?.label ?? languageAim?.aim ?? null) : null;
}
