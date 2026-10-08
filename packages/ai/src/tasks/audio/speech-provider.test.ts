import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSpeechWithProvider } from "./speech-provider";

const { gatewaySpeechMock, generateSpeechMock, openAISpeechMock } = vi.hoisted(() => ({
  gatewaySpeechMock: vi.fn((modelId: string) => ({ modelId, provider: "gateway" })),
  generateSpeechMock: vi.fn(),
  openAISpeechMock: vi.fn((modelId: string) => ({ modelId, provider: "openai" })),
}));

vi.mock("ai", () => ({ generateSpeech: generateSpeechMock }));
vi.mock("../../gateway", () => ({ zoonkGateway: { speechModel: gatewaySpeechMock } }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => ({ speech: openAISpeechMock }) }));

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

    expect(openAISpeechMock).not.toHaveBeenCalled();
  });

  it("never sends a language option, which no speech model reads and each warns about", async () => {
    await generateSpeechWithProvider({
      instructions: "The following text is Português Brasileiro.",
      model: "google/gemini-3.8-flash-lite-tts",
      text: "Oi",
      voice: "Kore",
    });

    expect(generateSpeechMock.mock.calls[0]?.[0]).not.toHaveProperty("language");
  });

  it("calls OpenAI directly with its own voice", async () => {
    await generateSpeechWithProvider({
      instructions: "The following text is US English.",
      model: "openai/gpt-4o-mini-tts",
      text: "Hello",
      voice: "Kore",
    });

    expect(openAISpeechMock).toHaveBeenCalledExactlyOnceWith("gpt-4o-mini-tts");

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      instructions: "The following text is US English.",
      model: { modelId: "gpt-4o-mini-tts", provider: "openai" },
      outputFormat: "wav",
      text: "Hello",
      voice: "marin",
    });

    expect(gatewaySpeechMock).not.toHaveBeenCalled();
  });
});
