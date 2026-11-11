import { describe, expect, it, vi } from "vitest";
import { NEUTRAL_ADDRESS_PROMPT, getAddressFormPrompt } from "./address-form";

vi.mock("./address-form.prompt.md", () => ({
  default:
    "Only words about the learner.\n{{#neutral}}\nNeutral.\n{{/neutral}}\n{{#feminine}}\nFeminine.\n{{/feminine}}\n{{#masculine}}\nMasculine.\n{{/masculine}}\n{{#conversation}}\nRequests hold for this conversation.\n{{/conversation}}\n",
}));

describe(getAddressFormPrompt, () => {
  it("addresses the learner neutrally when no form is passed", () => {
    expect(getAddressFormPrompt()).toBe(
      "Only words about the learner.\nNeutral.\nRequests hold for this conversation.\n",
    );
  });

  it.each([
    ["feminine", "Feminine."],
    ["masculine", "Masculine."],
    ["neutral", "Neutral."],
  ] as const)("keeps only the %s rules", (form, rule) => {
    expect(getAddressFormPrompt(form)).toBe(
      `Only words about the learner.\n${rule}\nRequests hold for this conversation.\n`,
    );
  });

  it("leaves out the learner's own requests where no conversation can make one", () => {
    expect(NEUTRAL_ADDRESS_PROMPT).toBe("Only words about the learner.\nNeutral.\n");
  });
});
