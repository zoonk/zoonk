import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLanguageAudio } from "./generate-language-audio";

const { generateWithGeminiMock, generateWithOpenAIMock } = vi.hoisted(() => ({
  generateWithGeminiMock: vi.fn(),
  generateWithOpenAIMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./generate-language-audio.prompt.md", () => ({
  default:
    'Some words may look like English words but they are {{LANGUAGE}} words and must be pronounced according to {{LANGUAGE}} phonology. For example, "fruit" in Dutch is pronounced "frœyt", not the English "froot."',
}));

vi.mock("./generate-language-audio-alphabet-symbol.prompt.md", () => ({ default: "" }));

vi.mock("./provider-gemini", () => ({ generateWithGemini: generateWithGeminiMock }));

vi.mock("./provider-openai", () => ({ generateWithOpenAI: generateWithOpenAIMock }));

describe(generateLanguageAudio, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateWithGeminiMock.mockResolvedValue({ audio: new Uint8Array([1, 2, 3]), format: "wav" });
  });

  it("skips prompt instructions for normal English audio", async () => {
    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();

    expect(generateWithGeminiMock).toHaveBeenCalledExactlyOnceWith({
      languageCode: "en",
      text: "fruit",
      voice: "Kore",
    });
  });

  it("keeps prompt instructions for non-English audio", async () => {
    const result = await generateLanguageAudio({ language: "nl", text: "fruit" });
    const call = generateWithGeminiMock.mock.calls[0]?.[0];

    expect(result.error).toBeNull();
    expect(call).toStrictEqual(expect.objectContaining({ languageCode: "nl", text: "fruit" }));
    expect(call?.instructions).toContain("Some words may look like English words");
  });
});
