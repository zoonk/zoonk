import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLanguageAudio } from "./generate-language-audio";

const { generateSpeechMock, getSpeechProviderMock } = vi.hoisted(() => ({
  generateSpeechMock: vi.fn(),
  getSpeechProviderMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("ai", () => ({ generateSpeech: generateSpeechMock }));

vi.mock("./generate-language-audio.prompt.md", () => ({
  default:
    'Some words may look like English words but they are {{LANGUAGE}} words and must be pronounced according to {{LANGUAGE}} phonology. For example, "fruit" in Dutch is pronounced "frœyt", not the English "froot."',
}));

vi.mock("./generate-language-audio-alphabet-symbol.prompt.md", () => ({ default: "" }));

vi.mock("./speech-provider", () => ({ getSpeechProvider: getSpeechProviderMock }));

/**
 * Mirrors the provider resolver's public result so these tests can focus on
 * task behavior without constructing real SDK models or making network calls.
 */
function createSpeechProvider({ model, voice }: { model: string; voice: string }) {
  if (model.startsWith("google/")) {
    return { format: "wav", model, voice };
  }

  return { format: "opus", model, voice: "marin" };
}

/**
 * Creates the minimal AI SDK speech result consumed by the task.
 */
function createSpeechResult(audio = new Uint8Array([1, 2, 3])) {
  return { audio: { uint8Array: audio } };
}

describe(generateLanguageAudio, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSpeechProviderMock.mockImplementation(createSpeechProvider);
    generateSpeechMock.mockResolvedValue(createSpeechResult());
  });

  it("uses the requested speech model instead of the default provider order", async () => {
    const result = await generateLanguageAudio({
      language: "en",
      model: "openai/gpt-4o-mini-tts",
      text: "fruit",
    });

    expect(result.error).toBeNull();
    expect(result.data?.format).toBe("opus");

    expect(getSpeechProviderMock).toHaveBeenCalledExactlyOnceWith({
      model: "openai/gpt-4o-mini-tts",
      voice: "Kore",
    });

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      model: "openai/gpt-4o-mini-tts",
      outputFormat: "opus",
      text: "fruit",
      voice: "marin",
    });
  });

  it("uses Gemini first when no model is requested", async () => {
    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data?.format).toBe("wav");

    expect(getSpeechProviderMock).toHaveBeenCalledExactlyOnceWith({
      model: "google/gemini-2.5-flash-preview-tts",
      voice: "Kore",
    });

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      model: "google/gemini-2.5-flash-preview-tts",
      outputFormat: "wav",
      text: "fruit",
      voice: "Kore",
    });
  });

  it("falls back to OpenAI when the default Gemini model fails", async () => {
    generateSpeechMock
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce(createSpeechResult());

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data?.format).toBe("opus");

    expect(getSpeechProviderMock).toHaveBeenNthCalledWith(1, {
      model: "google/gemini-2.5-flash-preview-tts",
      voice: "Kore",
    });

    expect(getSpeechProviderMock).toHaveBeenNthCalledWith(2, {
      model: "openai/gpt-4o-mini-tts",
      voice: "Kore",
    });
  });

  it("keeps prompt instructions for non-English audio", async () => {
    const result = await generateLanguageAudio({ language: "nl", text: "fruit" });
    const call = generateSpeechMock.mock.calls[0]?.[0];

    expect(result.error).toBeNull();
    expect(call).toStrictEqual(expect.objectContaining({ text: "fruit" }));
    expect(call?.instructions).toContain("Some words may look like English words");
  });

  it("falls back when Gemini returns suspiciously oversized WAV audio", async () => {
    generateSpeechMock
      .mockResolvedValueOnce(createSpeechResult(new Uint8Array(850 * 1024 + 1)))
      .mockResolvedValueOnce(createSpeechResult());

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data?.format).toBe("opus");
    expect(generateSpeechMock).toHaveBeenCalledTimes(2);
  });

  it("rejects suspiciously oversized audio from an explicitly requested OpenAI model", async () => {
    generateSpeechMock.mockResolvedValue(createSpeechResult(new Uint8Array(850 * 1024 + 1)));

    const result = await generateLanguageAudio({ model: "openai/gpt-4o-mini-tts", text: "fruit" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("returned oversized audio");
  });
});
