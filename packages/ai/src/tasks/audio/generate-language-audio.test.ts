import { beforeEach, describe, expect, it, vi } from "vitest";
import { type convertWavToMp3 } from "./convert-wav-to-mp3";
import { generateLanguageAudio } from "./generate-language-audio";
import { type generateSpeechWithProvider } from "./speech-provider";

const { convertWavToMp3Mock, generateSpeechWithProviderMock } = vi.hoisted(() => ({
  convertWavToMp3Mock: vi.fn<typeof convertWavToMp3>(),
  generateSpeechWithProviderMock: vi.fn<typeof generateSpeechWithProvider>(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./generate-language-audio-alphabet-symbol.prompt.md", () => ({
  default: "This audio is for one card in an alphabet lesson.",
}));

vi.mock("./convert-wav-to-mp3", () => ({ convertWavToMp3: convertWavToMp3Mock }));

vi.mock("./speech-provider", () => ({
  generateSpeechWithProvider: generateSpeechWithProviderMock,
}));

const FLASH = "google/gemini-3.8-flash-tts";
const FLASH_LITE = "google/gemini-3.8-flash-lite-tts";
const OPENAI = "openai/gpt-4o-mini-tts";

const wavAudio = new Uint8Array([1, 2, 3]);
const mp3Audio = new Uint8Array([4, 5, 6]);

function voiced() {
  return { audio: wavAudio, providerMetadata: {} };
}

/** The first request sent to a speech model. */
function firstRequest() {
  const [input] = generateSpeechWithProviderMock.mock.calls[0] ?? [];

  if (!input) {
    throw new Error("No speech request was sent");
  }

  return input;
}

/** The models asked for, in order. */
function requestedModels() {
  return generateSpeechWithProviderMock.mock.calls.map(([input]) => input.model);
}

describe(generateLanguageAudio, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSpeechWithProviderMock.mockResolvedValue(voiced());
    convertWavToMp3Mock.mockResolvedValue({ audio: mp3Audio, durationSeconds: 2.5 });
  });

  it("voices Italian with Gemini Flash, naming the language in every request", async () => {
    const result = await generateLanguageAudio({ language: "it", text: "Ciao, come stai?" });

    expect(result.error).toBeNull();

    expect(result.data).toStrictEqual({
      audio: mp3Audio,
      durationMs: 2500,
      format: "mp3",
      provenance: expect.objectContaining({
        costUsd: expect.any(Number),
        model: FLASH,
        promptVersion: expect.stringMatching(/^[a-f0-9]{12}$/u),
        requestedModel: FLASH,
        runId: expect.any(String),
        usage: { audioSeconds: 2.5, inputTokens: expect.any(Number) },
      }),
    });

    const call = firstRequest();

    expect(call).toStrictEqual({
      instructions: expect.stringContaining("The following text is Italiano."),
      model: FLASH,
      text: "Ciao, come stai?",
      voice: "Kore",
    });

    expect(call.instructions).toContain("pronounced according to Italiano phonology");
  });

  it("names English too, without the look-alike words reminder", async () => {
    await generateLanguageAudio({ language: "en", text: "fruit" });
    const call = firstRequest();

    expect(call.instructions).toContain("The following text is US English.");
    expect(call.instructions).not.toContain("phonology");
  });

  it("keeps the alphabet card's instructions between the reminder and the read-aloud line", async () => {
    await generateLanguageAudio({ language: "ja", text: "あ", usage: "alphabetSymbol" });
    const call = firstRequest();
    const { instructions } = call;

    expect(instructions.indexOf("phonology")).toBeLessThan(instructions.indexOf("alphabet lesson"));

    expect(instructions.indexOf("alphabet lesson")).toBeLessThan(
      instructions.indexOf("The following text is"),
    );
  });

  it("falls back to Flash Lite, then OpenAI, for a language OpenAI speaks", async () => {
    generateSpeechWithProviderMock
      .mockRejectedValueOnce(new Error("Flash unavailable"))
      .mockRejectedValueOnce(new Error("Flash Lite unavailable"))
      .mockResolvedValueOnce(voiced());

    const result = await generateLanguageAudio({ language: "es", text: "Hola" });

    expect(requestedModels()).toStrictEqual([FLASH, FLASH_LITE, OPENAI]);

    expect(result.data?.provenance).toStrictEqual(
      expect.objectContaining({ model: OPENAI, requestedModel: FLASH }),
    );
  });

  it("never sends a language OpenAI doesn't speak to OpenAI", async () => {
    generateSpeechWithProviderMock.mockRejectedValue(new Error("Gemini unavailable"));

    const result = await generateLanguageAudio({ language: "am", text: "ሰላም ነው።" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Gemini unavailable");
    expect(requestedModels()).toStrictEqual([FLASH, FLASH_LITE]);
  });

  it("falls back when a model's audio is silent", async () => {
    convertWavToMp3Mock
      .mockRejectedValueOnce(new Error(`${FLASH} returned silent audio`))
      .mockResolvedValueOnce({ audio: mp3Audio, durationSeconds: 1 });

    const result = await generateLanguageAudio({ language: "fr", text: "Bonjour" });

    expect(result.data?.provenance.model).toBe(FLASH_LITE);
    expect(requestedModels()).toStrictEqual([FLASH, FLASH_LITE]);
  });

  it("gives an explicitly requested model a second attempt", async () => {
    convertWavToMp3Mock
      .mockRejectedValueOnce(new Error(`${OPENAI} returned silent audio`))
      .mockResolvedValueOnce({ audio: mp3Audio, durationSeconds: 1 });

    const result = await generateLanguageAudio({ language: "en", model: OPENAI, text: "fruit" });

    expect(result.error).toBeNull();
    expect(requestedModels()).toStrictEqual([OPENAI, OPENAI]);
  });

  it("rejects oversized audio for a short text before decoding it", async () => {
    generateSpeechWithProviderMock.mockResolvedValue({
      audio: new Uint8Array(18 * 48_000 + 1025),
      providerMetadata: {},
    });

    const result = await generateLanguageAudio({ language: "en", model: FLASH, text: "fruit" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("returned oversized audio");
    expect(convertWavToMp3Mock).not.toHaveBeenCalled();
  });

  it("lets a long passage play longer than a word", async () => {
    const passage = "Una frase lunga. ".repeat(25).trim();

    await generateLanguageAudio({ language: "it", text: passage });

    expect(convertWavToMp3Mock).toHaveBeenCalledExactlyOnceWith({
      audio: wavAudio,
      maxSeconds: Math.ceil(passage.length / 8),
      model: FLASH,
    });

    await generateLanguageAudio({ language: "it", text: "Ciao" });

    expect(convertWavToMp3Mock).toHaveBeenLastCalledWith({
      audio: wavAudio,
      maxSeconds: 18,
      model: FLASH,
    });
  });
});
