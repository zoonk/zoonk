import addressFormTemplate from "./address-form.prompt.md";
import { selectPromptVariants } from "./prompt-variants";

export type AddressForm = "feminine" | "masculine" | "neutral";

/** The whole template, for a task's prompt version, so editing any form's rule changes it. */
export { default as addressFormTemplate } from "./address-form.prompt.md";

/** No saved form, or one not passed because the text is reused across learners, is neutral. */
export function getAddressFormPrompt(form: AddressForm = "neutral"): string {
  return selectPromptVariants({
    template: addressFormTemplate,
    variants: {
      feminine: form === "feminine",
      masculine: form === "masculine",
      neutral: form === "neutral",
    },
  });
}

export const NEUTRAL_ADDRESS_PROMPT = getAddressFormPrompt();
