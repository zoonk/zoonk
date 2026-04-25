import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateDirectDistractors } from "./generate-direct-distractors";

const { generateActivityDistractorsMock } = vi.hoisted(() => ({
  generateActivityDistractorsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/language/distractors", () => ({
  generateActivityDistractors: generateActivityDistractorsMock,
}));

describe(generateDirectDistractors, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns sanitized distractors keyed by entry key", async () => {
    generateActivityDistractorsMock.mockResolvedValue({
      data: { distractors: ["wrong1", "wrong2", "wrong3"] },
    });

    const result = await generateDirectDistractors({
      entries: [{ input: "hola", key: "word-1" }],
      language: "es",
      shape: "single-word",
    });

    expect(result["word-1"]).toEqual(expect.arrayContaining(["wrong1", "wrong2", "wrong3"]));

    expect(generateActivityDistractorsMock).toHaveBeenCalledWith({
      input: "hola",
      language: "es",
      shape: "single-word",
    });
  });

  test("throws when an AI call fails", async () => {
    generateActivityDistractorsMock.mockRejectedValue(new Error("AI failure"));

    await expect(
      generateDirectDistractors({
        entries: [{ input: "hola", key: "word-1" }],
        language: "es",
        shape: "single-word",
      }),
    ).rejects.toThrow("AI failure");
  });

  test("throws when any entry fails", async () => {
    generateActivityDistractorsMock
      .mockResolvedValueOnce({
        data: { distractors: ["d1", "d2", "d3"] },
      })
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({
        data: { distractors: ["d4", "d5", "d6"] },
      });

    await expect(
      generateDirectDistractors({
        entries: [
          { input: "hola", key: "k1" },
          { input: "adios", key: "k2" },
          { input: "gracias", key: "k3" },
        ],
        language: "es",
        shape: "single-word",
      }),
    ).rejects.toThrow("fail");
  });

  test("throws when AI returns null data", async () => {
    generateActivityDistractorsMock.mockResolvedValue({ data: null });

    await expect(
      generateDirectDistractors({
        entries: [{ input: "hola", key: "word-1" }],
        language: "es",
        shape: "single-word",
      }),
    ).rejects.toThrow("distractorGenerationFailed");
  });
});
