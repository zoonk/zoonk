import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithGemini } from "./provider-gemini";

const { generateContentMock, GoogleGenAIMock } = vi.hoisted(() => {
  const generateContent = vi.fn();

  class GoogleGenAI {
    models = { generateContent };
  }

  return { GoogleGenAIMock: vi.fn(GoogleGenAI), generateContentMock: generateContent };
});

vi.mock("@google/genai", () => ({ GoogleGenAI: GoogleGenAIMock }));

const MAX_EXPECTED_WAV_BYTES = 850 * 1024;
const WAV_HEADER_BYTES = 44;

/**
 * Builds the smallest Gemini response shape the provider reads. The provider
 * only needs base64 PCM bytes, so tests can control audio size without making
 * network calls or depending on the real SDK response class.
 */
function createGeminiAudioResponse({ audioData }: { audioData: string }) {
  return { candidates: [{ content: { parts: [{ inlineData: { data: audioData } }] } }] };
}

/**
 * Creates fake PCM data because Gemini returns raw PCM that production wraps in
 * a WAV header. The byte length lets tests exercise the same size guard that
 * protects uploads from prompt-leak audio.
 */
function createPcmBase64({ byteLength }: { byteLength: number }) {
  return Buffer.alloc(byteLength).toString("base64");
}

describe(generateWithGemini, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    generateContentMock.mockResolvedValue(
      createGeminiAudioResponse({ audioData: createPcmBase64({ byteLength: 3 }) }),
    );
  });

  it("keeps Gemini TTS instructions in content before the exact text to speak", async () => {
    const instructions = "Use Dutch phonology.";
    const text = "fruit";

    const result = await generateWithGemini({
      instructions,
      languageCode: "nl",
      text,
      voice: "Kore",
    });

    expect(result.format).toBe("wav");
    expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: process.env.GEMINI_API_KEY });

    expect(generateContentMock).toHaveBeenCalledExactlyOnceWith({
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: "nl",
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
      contents: [{ parts: [{ text: `${instructions}\n\nText to speak exactly:\n${text}` }] }],
      model: "gemini-2.5-flash-preview-tts",
    });
  });

  it("sends only the text when no TTS instructions are needed", async () => {
    const text = "fruit";

    const result = await generateWithGemini({ languageCode: "en", text, voice: "Kore" });

    expect(result.format).toBe("wav");

    expect(generateContentMock).toHaveBeenCalledExactlyOnceWith({
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: "en",
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
      contents: [{ parts: [{ text }] }],
      model: "gemini-2.5-flash-preview-tts",
    });
  });

  it("rejects oversized Gemini audio so fallback providers can retry", async () => {
    const oversizedPcmBytes = MAX_EXPECTED_WAV_BYTES - WAV_HEADER_BYTES + 1;

    generateContentMock.mockResolvedValueOnce(
      createGeminiAudioResponse({ audioData: createPcmBase64({ byteLength: oversizedPcmBytes }) }),
    );

    await expect(
      generateWithGemini({ instructions: "Use Dutch phonology.", text: "fruit", voice: "Kore" }),
    ).rejects.toThrow("Gemini TTS returned oversized audio");
  });
});
