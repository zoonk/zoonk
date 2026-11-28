import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { writeConversationFeedback } from "./conversation-feedback";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./conversation-feedback.prompt.md", () => ({
  default:
    "Fix it in {{TARGET_LANGUAGE}}.{{#bilingual}} Turn {{LEARNER_LANGUAGE}} into {{TARGET_LANGUAGE}}.{{/bilingual}}",
}));

vi.mock("../_utils/regional-forms.prompt.md", () => ({ default: "Regional forms." }));
vi.mock("../_utils/address-form.prompt.md", () => ({ default: "Address forms." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const CALL = {
  level: "B1" as const,
  objectivesMet: [],
  scenario: {
    characterName: "Sarah",
    objectives: ["Ask about the rent"],
    situation: "Call the landlord.",
    title: "Call the landlord",
  },
  turns: [{ speaker: "learner" as const, text: "How much is the rent?" }],
};

async function instructionsFor(languages: { learnerLanguage: string; targetLanguage: string }) {
  await writeConversationFeedback({ ...CALL, ...languages });
  const instructions = vi.mocked(generateText).mock.calls.at(-1)?.[0].instructions;
  return typeof instructions === "string" ? instructions : "";
}

describe(writeConversationFeedback, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        encouragement: "",
        improve: null,
        pronunciation: [],
        wentWell: [],
      }),
    );
  });

  it("turns words the learner said in their own language into the practiced one", async () => {
    const instructions = await instructionsFor({ learnerLanguage: "pt", targetLanguage: "en" });

    expect(instructions).toContain(
      "Fix it in US English. Turn Português Brasileiro into US English.",
    );
  });

  it("never treats speaking the practiced language as a switch when the learner reads it too", async () => {
    const instructions = await instructionsFor({ learnerLanguage: "en", targetLanguage: "en" });

    expect(instructions).toContain("Fix it in US English.\n");
    expect(instructions).not.toContain("Turn");
  });
});
