import { describe, expect, test, vi } from "vitest";
import { generateLessonRomanizations } from "./generate-lesson-romanizations";

const { generateLessonRomanizationMock } = vi.hoisted(() => ({
  generateLessonRomanizationMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: generateLessonRomanizationMock,
}));

describe(generateLessonRomanizations, () => {
  test("returns empty romanization map for Roman-script languages without calling AI", async () => {
    const result = await generateLessonRomanizations({
      targetLanguage: "es",
      texts: ["hola"],
    });

    expect(result).toEqual({});
    expect(generateLessonRomanizationMock).not.toHaveBeenCalled();
  });

  test("returns romanizations keyed by text for non-Roman languages", async () => {
    generateLessonRomanizationMock.mockResolvedValue({
      data: { romanizations: ["kore wa neko desu", "are wa inu desu"] },
    });

    const texts = ["これは猫です", "あれは犬です"];
    const result = await generateLessonRomanizations({ targetLanguage: "ja", texts });

    expect(result).toEqual({
      あれは犬です: "are wa inu desu",
      これは猫です: "kore wa neko desu",
    });
    expect(generateLessonRomanizationMock).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts,
    });
  });

  test("throws when AI call fails", async () => {
    generateLessonRomanizationMock.mockRejectedValue(new Error("AI error"));

    await expect(
      generateLessonRomanizations({
        targetLanguage: "ja",
        texts: ["これは猫です"],
      }),
    ).rejects.toThrow("AI error");
  });
});
