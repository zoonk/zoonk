import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSpeechWithProvider } from "./speech-provider";

const { gatewaySpeechMock, generateRealtimeSpeechMock, generateSpeechMock } = vi.hoisted(() => ({
  gatewaySpeechMock: vi.fn((modelId: string) => ({ modelId, provider: "gateway" })),
  generateRealtimeSpeechMock: vi.fn(),
  generateSpeechMock: vi.fn(),
}));

vi.mock("ai", () => ({ generateSpeech: generateSpeechMock }));
vi.mock("../../gateway", () => ({ zoonkGateway: { speechModel: gatewaySpeechMock } }));
vi.mock("./realtime-speech", () => ({ generateRealtimeSpeech: generateRealtimeSpeechMock }));

const audio = new Uint8Array([1, 2, 3]);
const providerMetadata = { gateway: { cost: "0.0001" } };

describe(generateSpeechWithProvider, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSpeechMock.mockResolvedValue({ audio: { uint8Array: audio }, providerMetadata });
  });

  it("sends Gemini through AI Gateway as WAV, its language named in the instructions", async () => {
    const result = await generateSpeechWithProvider({
      instructions: "The following text is Italiano.",
      language: "it",
      model: "google/gemini-3.8-flash-tts",
      text: "Ciao, come stai?",
      voice: "Kore",
    });

    expect(result).toStrictEqual({ audio, providerMetadata });
    expect(gatewaySpeechMock).toHaveBeenCalledExactlyOnceWith("google/gemini-3.8-flash-tts");

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      instructions: "The following text is Italiano.",
      model: { modelId: "google/gemini-3.8-flash-tts", provider: "gateway" },
      outputFormat: "wav",
      text: "Ciao, come stai?",
      voice: "Kore",
    });

    expect(generateRealtimeSpeechMock).not.toHaveBeenCalled();
  });

  it("never sends a language option, which no speech model reads and each warns about", async () => {
    await generateSpeechWithProvider({
      instructions: "The following text is Português Brasileiro.",
      language: "pt",
      model: "google/gemini-3.8-flash-lite-tts",
      text: "Oi",
      voice: "Kore",
    });

    expect(generateSpeechMock.mock.calls[0]?.[0]).not.toHaveProperty("language");
  });

  it("sends MAI-Voice through AI Gateway with Harper's voice for the language and no instructions", async () => {
    await generateSpeechWithProvider({
      instructions: "The following text is Português Brasileiro.",
      language: "pt-BR",
      model: "microsoft/mai-voice-2.1-flash",
      text: "Oi",
      voice: "Kore",
    });

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      model: { modelId: "microsoft/mai-voice-2.1-flash", provider: "gateway" },
      outputFormat: "wav",
      text: "Oi",
      voice: "pt-BR-Harper",
    });
  });

  it("fails a language MAI-Voice doesn't speak before calling it", async () => {
    await expect(
      generateSpeechWithProvider({
        instructions: "The following text is 日本語.",
        language: "ja",
        model: "microsoft/mai-voice-2.1-flash",
        text: "電車",
        voice: "Kore",
      }),
    ).rejects.toThrow("MAI-Voice doesn't speak ja");

    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("reads with an OpenAI realtime model over its own session in OpenAI's voice", async () => {
    generateRealtimeSpeechMock.mockResolvedValue({ audio, providerMetadata });

    const result = await generateSpeechWithProvider({
      instructions: "The following text is US English.",
      language: "en",
      model: "openai/gpt-realtime-2.1-mini",
      text: "Where is the station?",
      voice: "Kore",
    });

    expect(result).toStrictEqual({ audio, providerMetadata });

    expect(generateRealtimeSpeechMock).toHaveBeenCalledExactlyOnceWith({
      instructions: "The following text is US English.",
      model: "gpt-realtime-2.1-mini",
      text: "Where is the station?",
      voice: "marin",
    });

    expect(generateSpeechMock).not.toHaveBeenCalled();
  });
});
