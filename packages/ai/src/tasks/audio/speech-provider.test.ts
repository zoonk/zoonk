import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSpeechWithProvider } from "./speech-provider";

const { createGoogleMock, generateSpeechMock, googleSpeechMock, openAISpeechMock } = vi.hoisted(
  () => {
    const googleSpeech = vi.fn((modelId: string) => ({ modelId, provider: "google" }));

    return {
      createGoogleMock: vi.fn(() => ({ speech: googleSpeech })),
      generateSpeechMock: vi.fn(),
      googleSpeechMock: googleSpeech,
      openAISpeechMock: vi.fn((modelId: string) => ({ modelId, provider: "openai" })),
    };
  },
);

vi.mock("ai", () => ({ generateSpeech: generateSpeechMock }));
vi.mock("@ai-sdk/google", () => ({ createGoogle: createGoogleMock }));
vi.mock("@ai-sdk/openai", () => ({ openai: { speech: openAISpeechMock } }));

describe(generateSpeechWithProvider, () => {
  beforeEach(() => {
    generateSpeechMock.mockReset();
    googleSpeechMock.mockClear();
    openAISpeechMock.mockClear();
  });

  it("uses the AI SDK Google provider with WAV output", async () => {
    const audio = new Uint8Array([1, 2, 3]);
    generateSpeechMock.mockResolvedValue({ audio: { uint8Array: audio } });

    const result = await generateSpeechWithProvider({
      instructions: "Speak clearly",
      model: "google/gemini-2.5-flash-preview-tts",
      text: "Hallo",
      voice: "Kore",
    });

    expect(result).toBe(audio);
    expect(googleSpeechMock).toHaveBeenCalledExactlyOnceWith("gemini-2.5-flash-preview-tts");

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      instructions: "Speak clearly",
      model: { modelId: "gemini-2.5-flash-preview-tts", provider: "google" },
      outputFormat: "wav",
      text: "Hallo",
      voice: "Kore",
    });

    expect(openAISpeechMock).not.toHaveBeenCalled();
  });

  it("adds read-aloud guidance when Gemini receives no instructions", async () => {
    const audio = new Uint8Array([1, 2, 3]);
    generateSpeechMock.mockResolvedValue({ audio: { uint8Array: audio } });

    await generateSpeechWithProvider({
      model: "google/gemini-2.5-flash-preview-tts",
      text: "Hello",
      voice: "Kore",
    });

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      instructions: "Read the supplied transcript aloud. Return audio only.",
      model: { modelId: "gemini-2.5-flash-preview-tts", provider: "google" },
      outputFormat: "wav",
      text: "Hello",
      voice: "Kore",
    });
  });

  it("uses the AI SDK OpenAI provider with WAV output", async () => {
    const audio = new Uint8Array([1, 2, 3]);
    generateSpeechMock.mockResolvedValue({ audio: { uint8Array: audio } });

    const result = await generateSpeechWithProvider({
      model: "openai/gpt-4o-mini-tts",
      text: "Hallo",
      voice: "Kore",
    });

    expect(result).toBe(audio);
    expect(openAISpeechMock).toHaveBeenCalledExactlyOnceWith("gpt-4o-mini-tts");

    expect(generateSpeechMock).toHaveBeenCalledExactlyOnceWith({
      model: { modelId: "gpt-4o-mini-tts", provider: "openai" },
      outputFormat: "wav",
      text: "Hallo",
      voice: "marin",
    });

    expect(googleSpeechMock).not.toHaveBeenCalled();
  });
});
