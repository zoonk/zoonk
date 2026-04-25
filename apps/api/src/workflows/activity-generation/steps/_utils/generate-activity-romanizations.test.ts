import { describe, expect, test, vi } from "vitest";
import { generateActivityRomanizations } from "./generate-activity-romanizations";

const { generateActivityRomanizationMock } = vi.hoisted(() => ({
  generateActivityRomanizationMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: generateActivityRomanizationMock,
}));

describe(generateActivityRomanizations, () => {
  test("returns empty romanization map for Roman-script languages without calling AI", async () => {
    const result = await generateActivityRomanizations({
      targetLanguage: "es",
      texts: ["hola"],
    });

    expect(result).toEqual({});
    expect(generateActivityRomanizationMock).not.toHaveBeenCalled();
  });

  test("returns romanizations keyed by text for non-Roman languages", async () => {
    generateActivityRomanizationMock.mockResolvedValue({
      data: { romanizations: ["kore wa neko desu", "are wa inu desu"] },
    });

    const texts = ["これは猫です", "あれは犬です"];
    const result = await generateActivityRomanizations({ targetLanguage: "ja", texts });

    expect(result).toEqual({
      あれは犬です: "are wa inu desu",
      これは猫です: "kore wa neko desu",
    });

    expect(generateActivityRomanizationMock).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts,
    });
  });

  test("throws when AI call fails", async () => {
    generateActivityRomanizationMock.mockRejectedValue(new Error("AI error"));

    await expect(
      generateActivityRomanizations({
        targetLanguage: "ja",
        texts: ["これは猫です"],
      }),
    ).rejects.toThrow("AI error");
  });

  test("throws when AI returns no data", async () => {
    generateActivityRomanizationMock.mockResolvedValue({ data: null });

    await expect(
      generateActivityRomanizations({
        targetLanguage: "ja",
        texts: ["これは猫です"],
      }),
    ).rejects.toThrow("romanizationFailed");
  });

  test("filters out texts where AI returned undefined", async () => {
    generateActivityRomanizationMock.mockResolvedValue({
      data: { romanizations: ["kore wa neko desu", undefined] },
    });

    const result = await generateActivityRomanizations({
      targetLanguage: "ja",
      texts: ["これは猫です", "あれは犬です"],
    });

    expect(result).toEqual({ これは猫です: "kore wa neko desu" });
  });
});
