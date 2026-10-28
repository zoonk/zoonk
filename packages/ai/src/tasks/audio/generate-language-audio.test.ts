import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockTestGatewayFetch } from "../../_utils/block-test-gateway-fetch";
import { type convertWavToMp3 } from "./convert-wav-to-mp3";
import { generateLanguageAudio } from "./generate-language-audio";
import { type generateSpeechWithProvider } from "./speech-provider";

const {
  checkWordPronunciationMock,
  convertWavToMp3Mock,
  generateSpeechWithProviderMock,
  writeWordIpaMock,
} = vi.hoisted(() => ({
  checkWordPronunciationMock: vi.fn(),
  convertWavToMp3Mock: vi.fn<typeof convertWavToMp3>(),
  generateSpeechWithProviderMock: vi.fn<typeof generateSpeechWithProvider>(),
  writeWordIpaMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./generate-language-audio-alphabet-symbol.prompt.md", () => ({
  default: "This audio is for one card in an alphabet lesson.",
}));

vi.mock("./convert-wav-to-mp3", () => ({ convertWavToMp3: convertWavToMp3Mock }));

vi.mock("./speech-provider", () => ({
  generateSpeechWithProvider: generateSpeechWithProviderMock,
}));

vi.mock("../v2/language/word-ipa", () => ({ writeWordIpa: writeWordIpaMock }));

vi.mock("../v2/language/check-word-pronunciation", () => ({
  checkWordPronunciation: checkWordPronunciationMock,
}));

function wordIpa(data: { englishIpa: string | null; ipa: string | null }) {
  return { data };
}

function heardAs(pronunciation: "english" | "native" | "unclear") {
  return { data: { heard: "naːmə", pronunciation, soundsNative: pronunciation === "native" } };
}

const FLASH = "google/gemini-3.8-flash-tts";
const FLASH_LITE = "google/gemini-3.8-flash-lite-tts";
const MAI_VOICE = "microsoft/mai-voice-2.1-flash";

const wavAudio = new Uint8Array([1, 2, 3]);
const mp3Audio = new Uint8Array([4, 5, 6]);

function voiced() {
  return { audio: wavAudio, providerMetadata: {} };
}

function firstRequest() {
  const [input] = generateSpeechWithProviderMock.mock.calls[0] ?? [];

  if (!input) {
    throw new Error("No speech request was sent");
  }

  return input;
}

function requestedModels() {
  return generateSpeechWithProviderMock.mock.calls.map(([input]) => input.model);
}

describe(generateLanguageAudio, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSpeechWithProviderMock.mockResolvedValue(voiced());
    convertWavToMp3Mock.mockResolvedValue({ audio: mp3Audio, durationSeconds: 2.5 });
    writeWordIpaMock.mockResolvedValue(wordIpa({ englishIpa: null, ipa: "ˈpalavɾa" }));
    checkWordPronunciationMock.mockResolvedValue(heardAs("native"));
  });

  it("gives a word English spells the same its IPA, on Gemini Flash only", async () => {
    writeWordIpaMock.mockResolvedValue(wordIpa({ englishIpa: "neɪm", ipa: "ˈnaːmə" }));
    generateSpeechWithProviderMock.mockRejectedValue(new Error("unavailable"));

    await generateLanguageAudio({ language: "de", text: "Name" });

    expect(writeWordIpaMock).toHaveBeenCalledExactlyOnceWith({ language: "de", word: "Name" });
    expect(firstRequest().instructions).toContain("Pronounce it /ˈnaːmə/.");
    expect(requestedModels()).toStrictEqual([FLASH, FLASH, FLASH]);
  });

  it("voices a look-alike word again when it was read the English way", async () => {
    writeWordIpaMock.mockResolvedValue(wordIpa({ englishIpa: "neɪm", ipa: "ˈnaːmə" }));

    checkWordPronunciationMock
      .mockResolvedValueOnce(heardAs("english"))
      .mockResolvedValue(heardAs("native"));

    const result = await generateLanguageAudio({ language: "de", text: "Name" });

    expect(result.error).toBeNull();
    expect(requestedModels()).toStrictEqual([FLASH, FLASH]);
    // Two listens of each clip, and one listen hearing English was enough to voice it again.
    expect(checkWordPronunciationMock).toHaveBeenCalledTimes(4);

    expect(checkWordPronunciationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: mp3Audio,
        englishIpa: "neɪm",
        ipa: "ˈnaːmə",
        language: "de",
        mediaType: "audio/mpeg",
        word: "Name",
      }),
    );
  });

  it("fails a look-alike word every model read the English way, to voice it again later", async () => {
    writeWordIpaMock.mockResolvedValue(wordIpa({ englishIpa: "neɪm", ipa: "ˈnaːmə" }));
    checkWordPronunciationMock.mockResolvedValue(heardAs("unclear"));

    const result = await generateLanguageAudio({ language: "de", text: "Name" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("didn't read \"Name\" with its language's sounds");
  });

  it("keeps a look-alike word's clip when the check can't run", async () => {
    writeWordIpaMock.mockResolvedValue(wordIpa({ englishIpa: "neɪm", ipa: "ˈnaːmə" }));
    checkWordPronunciationMock.mockRejectedValue(new Error("Gemini unavailable"));

    const result = await generateLanguageAudio({ language: "de", text: "Name" });

    expect(result.error).toBeNull();
    expect(requestedModels()).toStrictEqual([FLASH]);
  });

  it("still fails a look-alike word when one listen heard English and the other couldn't run", async () => {
    writeWordIpaMock.mockResolvedValue(wordIpa({ englishIpa: "neɪm", ipa: "ˈnaːmə" }));

    checkWordPronunciationMock
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce(heardAs("english"))
      .mockResolvedValue(heardAs("native"));

    const result = await generateLanguageAudio({ language: "de", text: "Name" });

    expect(result.error).toBeNull();
    expect(requestedModels()).toStrictEqual([FLASH, FLASH]);
  });

  it("leaves a word of the language's own as it was", async () => {
    generateSpeechWithProviderMock.mockRejectedValue(new Error("unavailable"));

    await generateLanguageAudio({ language: "es", text: "mariposa" });

    expect(firstRequest().instructions).not.toContain("Pronounce it");
    expect(requestedModels()).toStrictEqual([FLASH, FLASH_LITE, MAI_VOICE]);
    expect(checkWordPronunciationMock).not.toHaveBeenCalled();
  });

  it("still voices a word whose IPA couldn't be written", async () => {
    writeWordIpaMock.mockRejectedValue(new Error("IPA unavailable"));

    const result = await generateLanguageAudio({ language: "nl", text: "fruit" });

    expect(result.error).toBeNull();
    expect(firstRequest().instructions).not.toContain("Pronounce it");
  });

  it.each([
    ["a sentence", "es", "Hola, ¿qué tal?"],
    ["English", "en", "fruit"],
    ["a script English doesn't share", "ja", "電車"],
  ])("never looks up IPA for %s", async (_, language, text) => {
    await generateLanguageAudio({ language, text });

    expect(writeWordIpaMock).not.toHaveBeenCalled();
  });

  it("never looks up IPA for an alphabet card, which reads a letter's sound", async () => {
    await generateLanguageAudio({ language: "pl", text: "ł", usage: "alphabetSymbol" });

    expect(writeWordIpaMock).not.toHaveBeenCalled();
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
        usage: { audioSeconds: 2.5, characters: 16, inputTokens: expect.any(Number) },
      }),
    });

    const call = firstRequest();

    expect(call).toStrictEqual({
      instructions: expect.stringContaining("The following text is Italiano."),
      language: "it",
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

  it("falls back to Flash Lite, then MAI-Voice for a language MAI-Voice speaks", async () => {
    generateSpeechWithProviderMock
      .mockRejectedValueOnce(new Error("Flash unavailable"))
      .mockRejectedValueOnce(new Error("Flash Lite unavailable"))
      .mockResolvedValueOnce(voiced());

    const result = await generateLanguageAudio({ language: "es", text: "Hola, ¿qué tal?" });

    expect(requestedModels()).toStrictEqual([FLASH, FLASH_LITE, MAI_VOICE]);

    expect(result.data?.provenance).toStrictEqual(
      expect.objectContaining({ model: MAI_VOICE, requestedModel: FLASH }),
    );
  });

  it("stops at a call the test kill switch blocked, since every model is behind it", async () => {
    const blocked = await blockTestGatewayFetch("https://ai-gateway.test").catch(
      (error: unknown) => error,
    );

    generateSpeechWithProviderMock.mockRejectedValue(blocked);

    const result = await generateLanguageAudio({ language: "es", text: "Hola, ¿qué tal?" });

    expect(result.error).toBe(blocked);
    expect(requestedModels()).toStrictEqual([FLASH]);
  });

  it("keeps a language MAI-Voice doesn't speak on Gemini", async () => {
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
      .mockRejectedValueOnce(new Error(`${MAI_VOICE} returned silent audio`))
      .mockResolvedValueOnce({ audio: mp3Audio, durationSeconds: 1 });

    const result = await generateLanguageAudio({ language: "en", model: MAI_VOICE, text: "fruit" });

    expect(result.error).toBeNull();
    expect(requestedModels()).toStrictEqual([MAI_VOICE, MAI_VOICE]);
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
