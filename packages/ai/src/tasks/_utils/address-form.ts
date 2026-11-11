import addressFormTemplate from "./address-form.prompt.md";
import { selectPromptVariants } from "./prompt-variants";

export type AddressForm = "feminine" | "masculine" | "neutral";

/** The whole template, for a task's prompt version, so editing any form's rule changes it. */
export { default as addressFormTemplate } from "./address-form.prompt.md";

function selectAddressForm({ conversation, form }: { conversation: boolean; form: AddressForm }) {
  return selectPromptVariants({
    template: addressFormTemplate,
    variants: {
      conversation,
      feminine: form === "feminine",
      masculine: form === "masculine",
      neutral: form === "neutral",
    },
  });
}

/**
 * For a conversation with one learner, who may ask in it to be addressed another way. No saved
 * form, or one not passed because the answer is reused across learners, is neutral.
 */
export function getAddressFormPrompt(form: AddressForm = "neutral"): string {
  return selectAddressForm({ conversation: true, form });
}

/** For text reused across learners or written without a conversation: always neutral. */
export const NEUTRAL_ADDRESS_PROMPT = selectAddressForm({ conversation: false, form: "neutral" });
