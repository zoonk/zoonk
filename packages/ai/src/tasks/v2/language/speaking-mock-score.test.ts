import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { scoreSpeakingMock } from "./speaking-mock-score";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./speaking-mock-score.prompt.md", () => ({ default: "Rate the mock." }));
vi.mock("./speaking-mock-score-ielts.prompt.md", () => ({ default: "IELTS bands." }));
vi.mock("./speaking-mock-score-toefl.prompt.md", () => ({ default: "TOEFL bands." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function criterion(band: number) {
  return { bandHigh: band + 0.5, bandLow: band, evidence: "You said 'it is good'.", tip: "Try." };
}

const TURNS = [
  { speaker: "character" as const, text: "Can you tell me your full name?" },
  { speaker: "learner" as const, text: "My name is Ana and I live in Recife." },
];

describe(scoreSpeakingMock, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rates with the shared rules and only the scored exam's rubric", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        fluencyCoherence: criterion(6),
        focus: "grammar",
        grammar: criterion(5.5),
        lexicalResource: criterion(6),
        pronunciation: criterion(5.5),
      }),
    );

    const ielts = await scoreSpeakingMock({
      exam: "ielts",
      learnerLanguage: "pt",
      spokenSeconds: 90,
      targetLanguage: "en",
      turns: TURNS,
    });

    expect(ielts.systemPrompt).toBe("Rate the mock.\nIELTS bands.");
    expect(ielts.data).toMatchObject({ exam: "ielts", focus: "grammar" });

    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        delivery: criterion(3),
        elaboration: criterion(3),
        focus: "repetition",
        grammar: criterion(3),
        repetition: criterion(2.5),
        vocabulary: criterion(3),
      }),
    );

    const toefl = await scoreSpeakingMock({
      exam: "toefl",
      learnerLanguage: "pt",
      spokenSeconds: 90,
      targetLanguage: "en",
      turns: TURNS,
    });

    expect(toefl.systemPrompt).toBe("Rate the mock.\nTOEFL bands.");

    expect(
      vi.mocked(generateText).mock.calls.map(([options]) => options.instructions),
    ).toStrictEqual(["Rate the mock.\nIELTS bands.", "Rate the mock.\nTOEFL bands."]);
  });
});
