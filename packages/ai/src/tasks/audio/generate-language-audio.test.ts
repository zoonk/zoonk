import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLanguageAudio } from "./generate-language-audio";

const { convertWavToMp3Mock, generateSpeechWithProviderMock } = vi.hoisted(() => ({
  convertWavToMp3Mock: vi.fn(),
  generateSpeechWithProviderMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./generate-language-audio.prompt.md", () => ({
  default:
    'Some words may look like English words but they are {{LANGUAGE}} words and must be pronounced according to {{LANGUAGE}} phonology. For example, "fruit" in Dutch is pronounced "frœyt", not the English "froot."',
}));

vi.mock("./generate-language-audio-alphabet-symbol.prompt.md", () => ({ default: "" }));

vi.mock("./convert-wav-to-mp3", () => ({ convertWavToMp3: convertWavToMp3Mock }));

vi.mock("./speech-provider", () => ({
  generateSpeechWithProvider: generateSpeechWithProviderMock,
}));

describe(generateLanguageAudio, () => {
  const googleWavAudio = new Uint8Array([1, 2, 3]);
  const googleMp3Audio = new Uint8Array([4, 5, 6]);
  const openAIWavAudio = new Uint8Array([7, 8, 9]);
  const openAIMp3Audio = new Uint8Array([10, 11, 12]);

  beforeEach(() => {
    vi.clearAllMocks();
    generateSpeechWithProviderMock.mockResolvedValue(googleWavAudio);
    convertWavToMp3Mock.mockResolvedValue(googleMp3Audio);
  });

  it("converts requested OpenAI WAV to MP3", async () => {
    generateSpeechWithProviderMock.mockResolvedValue(openAIWavAudio);
    convertWavToMp3Mock.mockResolvedValue(openAIMp3Audio);

    const result = await generateLanguageAudio({
      language: "en",
      model: "openai/gpt-4o-mini-tts",
      text: "fruit",
    });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: openAIMp3Audio, format: "mp3" });

    expect(generateSpeechWithProviderMock).toHaveBeenCalledExactlyOnceWith({
      model: "openai/gpt-4o-mini-tts",
      text: "fruit",
      voice: "Kore",
    });

    expect(convertWavToMp3Mock).toHaveBeenCalledExactlyOnceWith({
      audio: openAIWavAudio,
      model: "openai/gpt-4o-mini-tts",
    });
  });

  it("uses OpenAI for English words", async () => {
    generateSpeechWithProviderMock.mockResolvedValue(openAIWavAudio);
    convertWavToMp3Mock.mockResolvedValue(openAIMp3Audio);

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: openAIMp3Audio, format: "mp3" });

    expect(generateSpeechWithProviderMock).toHaveBeenCalledExactlyOnceWith({
      model: "openai/gpt-4o-mini-tts",
      text: "fruit",
      voice: "Kore",
    });

    expect(convertWavToMp3Mock).toHaveBeenCalledExactlyOnceWith({
      audio: openAIWavAudio,
      model: "openai/gpt-4o-mini-tts",
    });
  });

  it("falls back to Gemini when OpenAI fails for English words", async () => {
    generateSpeechWithProviderMock
      .mockRejectedValueOnce(new Error("OpenAI unavailable"))
      .mockResolvedValueOnce(googleWavAudio);

    convertWavToMp3Mock.mockResolvedValue(googleMp3Audio);

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: googleMp3Audio, format: "mp3" });

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(1, {
      model: "openai/gpt-4o-mini-tts",
      text: "fruit",
      voice: "Kore",
    });

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(2, {
      model: "google/gemini-2.5-flash-preview-tts",
      text: "fruit",
      voice: "Kore",
    });

    expect(convertWavToMp3Mock).toHaveBeenCalledExactlyOnceWith({
      audio: googleWavAudio,
      model: "google/gemini-2.5-flash-preview-tts",
    });
  });

  it("falls back to Gemini when OpenAI fails for supported non-English sentences", async () => {
    generateSpeechWithProviderMock
      .mockRejectedValueOnce(new Error("OpenAI unavailable"))
      .mockResolvedValueOnce(googleWavAudio);

    convertWavToMp3Mock.mockResolvedValue(googleMp3Audio);

    const result = await generateLanguageAudio({
      language: "es",
      text: "La fruta es deliciosa.",
      textType: "sentence",
    });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: googleMp3Audio, format: "mp3" });

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "openai/gpt-4o-mini-tts" }),
    );

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "google/gemini-2.5-flash-preview-tts" }),
    );
  });

  it("falls back to OpenAI when Gemini fails for supported non-English words", async () => {
    generateSpeechWithProviderMock
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce(openAIWavAudio);

    convertWavToMp3Mock.mockResolvedValue(openAIMp3Audio);

    const result = await generateLanguageAudio({ language: "nl", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: openAIMp3Audio, format: "mp3" });

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "google/gemini-2.5-flash-preview-tts" }),
    );

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "openai/gpt-4o-mini-tts" }),
    );
  });

  it("never uses OpenAI for unsupported languages", async () => {
    generateSpeechWithProviderMock.mockRejectedValue(new Error("Gemini unavailable"));

    const result = await generateLanguageAudio({
      language: "am",
      text: "ሰላም ነው።",
      textType: "sentence",
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Gemini unavailable");
    expect(generateSpeechWithProviderMock).toHaveBeenCalledTimes(2);

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "google/gemini-2.5-flash-preview-tts" }),
    );

    expect(generateSpeechWithProviderMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "google/gemini-2.5-flash-preview-tts" }),
    );
  });

  it("keeps prompt instructions for non-English audio", async () => {
    const result = await generateLanguageAudio({ language: "nl", text: "fruit" });
    const call = generateSpeechWithProviderMock.mock.calls[0]?.[0];

    expect(result.error).toBeNull();
    expect(call).toStrictEqual(expect.objectContaining({ text: "fruit" }));
    expect(call?.instructions).toContain("Some words may look like English words");
  });

  it("falls back before conversion when OpenAI returns oversized English WAV", async () => {
    generateSpeechWithProviderMock
      .mockResolvedValueOnce(new Uint8Array(850 * 1024 + 1))
      .mockResolvedValueOnce(googleWavAudio);

    convertWavToMp3Mock.mockResolvedValue(googleMp3Audio);

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: googleMp3Audio, format: "mp3" });
    expect(generateSpeechWithProviderMock).toHaveBeenCalledTimes(2);

    expect(convertWavToMp3Mock).toHaveBeenCalledExactlyOnceWith({
      audio: googleWavAudio,
      model: "google/gemini-2.5-flash-preview-tts",
    });
  });

  it("falls back when OpenAI returns silent English WAV", async () => {
    const silentWavAudio = new Uint8Array([13, 14, 15]);

    generateSpeechWithProviderMock
      .mockResolvedValueOnce(silentWavAudio)
      .mockResolvedValueOnce(googleWavAudio);

    convertWavToMp3Mock
      .mockRejectedValueOnce(new Error("openai returned silent audio"))
      .mockResolvedValueOnce(googleMp3Audio);

    const result = await generateLanguageAudio({ language: "en", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: googleMp3Audio, format: "mp3" });

    expect(convertWavToMp3Mock).toHaveBeenNthCalledWith(1, {
      audio: silentWavAudio,
      model: "openai/gpt-4o-mini-tts",
    });

    expect(convertWavToMp3Mock).toHaveBeenNthCalledWith(2, {
      audio: googleWavAudio,
      model: "google/gemini-2.5-flash-preview-tts",
    });
  });

  it("retries silent WAV when OpenAI is requested explicitly", async () => {
    const audibleWavAudio = new Uint8Array([16, 17, 18]);

    generateSpeechWithProviderMock
      .mockResolvedValueOnce(openAIWavAudio)
      .mockResolvedValueOnce(audibleWavAudio);

    convertWavToMp3Mock
      .mockRejectedValueOnce(new Error("openai returned silent audio"))
      .mockResolvedValueOnce(openAIMp3Audio);

    const result = await generateLanguageAudio({ model: "openai/gpt-4o-mini-tts", text: "fruit" });

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual({ audio: openAIMp3Audio, format: "mp3" });
    expect(generateSpeechWithProviderMock).toHaveBeenCalledTimes(2);
  });

  it("returns an error after explicitly requested OpenAI remains silent", async () => {
    generateSpeechWithProviderMock.mockResolvedValue(openAIWavAudio);
    convertWavToMp3Mock.mockRejectedValue(new Error("openai returned silent audio"));

    const result = await generateLanguageAudio({ model: "openai/gpt-4o-mini-tts", text: "fruit" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("returned silent audio");
    expect(generateSpeechWithProviderMock).toHaveBeenCalledTimes(2);
  });

  it("rejects oversized OpenAI WAV before conversion", async () => {
    generateSpeechWithProviderMock.mockResolvedValue(new Uint8Array(850 * 1024 + 1));

    const result = await generateLanguageAudio({ model: "openai/gpt-4o-mini-tts", text: "fruit" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("returned oversized audio");
    expect(convertWavToMp3Mock).not.toHaveBeenCalled();
  });
});
