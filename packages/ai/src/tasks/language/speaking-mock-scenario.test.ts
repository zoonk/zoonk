import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateSpeakingMockScenario } from "./speaking-mock-scenario";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./speaking-mock-scenario.prompt.md", () => ({ default: "Write a speaking mock." }));
vi.mock("./speaking-mock-scenario-ielts.prompt.md", () => ({ default: "IELTS's three parts." }));
vi.mock("./speaking-mock-scenario-toefl.prompt.md", () => ({ default: "TOEFL's two tasks." }));
vi.mock("./conversation-scenario.prompt.md", () => ({ default: "Write a role play." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const SCENARIO = {
  character: { name: "Sarah", place: "Test centre", role: "examinadora" },
  characterBrief: "Script.",
  hints: ["In my opinion...", "For example...", "Let me think..."],
  objectives: [
    { description: "Responda.", label: "Listen and Repeat" },
    { description: "Responda.", label: "Take an Interview" },
  ],
  openingLine: "Hello, I'm Sarah.",
  situation: "Um simulado.",
  title: "Simulado do TOEFL",
};

describe(generateSpeakingMockScenario, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(SCENARIO));
  });

  it("sends the shared mock rules and only the mocked exam's parts", async () => {
    const toefl = await generateSpeakingMockScenario({
      exam: "toefl",
      learnerLanguage: "pt",
      level: "A2",
      minutes: 5,
      targetLanguage: "en",
    });

    expect(toefl.data).toStrictEqual(SCENARIO);
    expect(toefl.systemPrompt).toBe("Write a speaking mock.\nTOEFL's two tasks.");
    expect(toefl.userPrompt).toContain("MINUTES: 5");

    const ielts = await generateSpeakingMockScenario({
      exam: "ielts",
      learnerLanguage: "en",
      level: "B2",
      minutes: 5,
      targetLanguage: "en",
    });

    expect(ielts.systemPrompt).toBe("Write a speaking mock.\nIELTS's three parts.");

    expect(vi.mocked(generateText).mock.calls[1]?.[0]).toMatchObject({
      instructions: "Write a speaking mock.\nIELTS's three parts.",
    });
  });
});
