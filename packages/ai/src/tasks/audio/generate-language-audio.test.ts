import { generateSpeech } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLanguageAudio } from "./generate-language-audio";
import { LANGUAGE_AUDIO_MODELS } from "./language-audio-models";

const { generateSpeechMock, geminiModel, googleSpeechMock, openaiModel, openaiSpeechMock } =
  vi.hoisted(() => {
    const googleModel = {
      modelId: "gemini-2.5-flash-preview-tts",
      provider: "google.generative-ai.speech",
    };

    const fallbackModel = { modelId: "gpt-4o-mini-tts", provider: "openai.speech" };

    return {
      geminiModel: googleModel,
      generateSpeechMock: vi.fn(),
      googleSpeechMock: vi.fn(() => googleModel),
      openaiModel: fallbackModel,
      openaiSpeechMock: vi.fn(() => fallbackModel),
    };
  });

vi.mock("server-only", () => ({}));

vi.mock("@ai-sdk/google", () => ({ google: { speech: googleSpeechMock } }));

vi.mock("@ai-sdk/openai", () => ({ openai: { speech: openaiSpeechMock } }));

vi.mock("ai", () => ({ generateSpeech: generateSpeechMock }));

vi.mock("./generate-language-audio.prompt.md", () => ({
  default:
    'Some words may look like English words but they are {{LANGUAGE}} words and must be pronounced according to {{LANGUAGE}} phonology. For example, "fruit" in Dutch is pronounced "frœyt", not the English "froot."',
}));

vi.mock("./generate-language-audio-alphabet-symbol.prompt.md", () => ({ default: "" }));

const MAX_EXPECTED_AUDIO_BYTES = 850 * 1024;

describe(generateLanguageAudio, () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    generateSpeechMock.mockResolvedValue({ audio: { uint8Array: new Uint8Array([1, 2, 3]) } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips prompt instructions for normal English audio", async () => {
    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();

    expect(result.data).toStrictEqual({ audio: new Uint8Array([1, 2, 3]), format: "wav" });

    expect(generateSpeech).toHaveBeenCalledExactlyOnceWith({
      model: geminiModel,
      outputFormat: "wav",
      text: "fruit",
      voice: "Kore",
    });
  });

  it("keeps prompt instructions for non-English audio", async () => {
    const result = await generateLanguageAudio({ language: "nl", text: "fruit" });
    const call = generateSpeechMock.mock.calls[0]?.[0];

    expect(result.error).toBeNull();

    expect(call).toStrictEqual(
      expect.objectContaining({ model: geminiModel, outputFormat: "wav", text: "fruit" }),
    );

    expect(call?.instructions).toContain("Some words may look like English words");
  });

  it("uses OpenAI through the same speech call when Gemini fails", async () => {
    generateSpeechMock
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce({ audio: { uint8Array: new Uint8Array([4, 5, 6]) } });

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: new Uint8Array([4, 5, 6]), format: "opus" });

    expect(generateSpeech).toHaveBeenNthCalledWith(2, {
      model: openaiModel,
      outputFormat: "opus",
      text: "fruit",
      voice: "marin",
    });
  });

  it("rejects oversized audio before trying the next provider", async () => {
    generateSpeechMock
      .mockResolvedValueOnce({
        audio: { uint8Array: new Uint8Array(MAX_EXPECTED_AUDIO_BYTES + 1) },
      })
      .mockResolvedValueOnce({ audio: { uint8Array: new Uint8Array([4, 5, 6]) } });

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: new Uint8Array([4, 5, 6]), format: "opus" });
    expect(generateSpeech).toHaveBeenCalledTimes(2);
  });

  it("rejects oversized audio from fallback providers too", async () => {
    vi.useFakeTimers();

    generateSpeechMock
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce({
        audio: { uint8Array: new Uint8Array(MAX_EXPECTED_AUDIO_BYTES + 1) },
      })
      .mockResolvedValueOnce({ audio: { uint8Array: new Uint8Array([7, 8, 9]) } });

    const resultPromise = generateLanguageAudio({ language: "en", text: "fruit" });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: new Uint8Array([7, 8, 9]), format: "wav" });

    expect(generateSpeech).toHaveBeenNthCalledWith(3, {
      model: geminiModel,
      outputFormat: "wav",
      text: "fruit",
      voice: "Kore",
    });
  });

  it("can pin generation to the OpenAI model without trying Gemini first", async () => {
    const result = await generateLanguageAudio({
      language: "en",
      model: LANGUAGE_AUDIO_MODELS[1].id,
      text: "fruit",
    });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: new Uint8Array([1, 2, 3]), format: "opus" });

    expect(generateSpeech).toHaveBeenCalledExactlyOnceWith({
      model: openaiModel,
      outputFormat: "opus",
      text: "fruit",
      voice: "marin",
    });
  });
});
