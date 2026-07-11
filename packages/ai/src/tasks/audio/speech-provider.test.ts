import { describe, expect, it, vi } from "vitest";
import { getSpeechProvider } from "./speech-provider";

const { createGoogleMock, googleSpeechMock, openAISpeechMock } = vi.hoisted(() => {
  const googleSpeech = vi.fn((modelId: string) => ({ modelId, provider: "google" }));

  return {
    createGoogleMock: vi.fn(() => ({ speech: googleSpeech })),
    googleSpeechMock: googleSpeech,
    openAISpeechMock: vi.fn((modelId: string) => ({ modelId, provider: "openai" })),
  };
});

vi.mock("@ai-sdk/google", () => ({ createGoogle: createGoogleMock }));
vi.mock("@ai-sdk/openai", () => ({ openai: { speech: openAISpeechMock } }));

describe(getSpeechProvider, () => {
  it("uses the AI SDK Google provider and keeps Gemini WAV output", () => {
    const provider = getSpeechProvider({
      model: "google/gemini-2.5-flash-preview-tts",
      voice: "Kore",
    });

    expect(createGoogleMock).toHaveBeenCalledWith({ apiKey: process.env.GEMINI_API_KEY });
    expect(googleSpeechMock).toHaveBeenCalledWith("gemini-2.5-flash-preview-tts");

    expect(provider).toStrictEqual({
      format: "wav",
      model: { modelId: "gemini-2.5-flash-preview-tts", provider: "google" },
      voice: "Kore",
    });
  });

  it("uses the AI SDK OpenAI provider with Opus and its compatible voice", () => {
    const provider = getSpeechProvider({ model: "openai/gpt-4o-mini-tts", voice: "Kore" });

    expect(openAISpeechMock).toHaveBeenCalledWith("gpt-4o-mini-tts");

    expect(provider).toStrictEqual({
      format: "opus",
      model: { modelId: "gpt-4o-mini-tts", provider: "openai" },
      voice: "marin",
    });
  });
});
