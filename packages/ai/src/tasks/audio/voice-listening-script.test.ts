import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWavAudio } from "./_test-utils/wav-fixture";
import { type generateSpeechWithProvider } from "./speech-provider";
import { voiceListeningScript } from "./voice-listening-script";

const { generateSpeechWithProviderMock } = vi.hoisted(() => ({
  generateSpeechWithProviderMock: vi.fn<typeof generateSpeechWithProvider>(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./speech-provider", () => ({
  generateSpeechWithProvider: generateSpeechWithProviderMock,
}));

const FLASH = "google/gemini-3.8-flash-tts";
const FLASH_LITE = "google/gemini-3.8-flash-lite-tts";

const LINES = [
  { accent: "British English", text: "Good morning, how can I help?", voice: "Kore" },
  { accent: "Australian English", text: "I'd like to book the small hall.", voice: "Puck" },
] as const;

function speaks(seconds: number) {
  return {
    audio: createWavAudio({ amplitude: 1000, durationSeconds: seconds }),
    providerMetadata: {},
  };
}

describe(voiceListeningScript, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSpeechWithProviderMock.mockResolvedValue(speaks(2));
  });

  it("voices each turn in its speaker's voice and accent and joins them into one recording", async () => {
    const { data, error } = await voiceListeningScript({
      language: "en",
      lines: LINES,
      serviceTier: "flex",
    });

    expect(error).toBeNull();
    expect(data?.format).toBe("mp3");
    // Two seconds a turn and the pause between the speakers.
    expect(data?.durationMs).toBe(4600);

    expect(data?.provenance).toMatchObject({
      model: FLASH_LITE,
      usage: { audioSeconds: 4, inputTokens: expect.any(Number) },
    });

    expect(generateSpeechWithProviderMock.mock.calls.map(([input]) => input)).toStrictEqual([
      {
        instructions: expect.stringContaining("unmistakable British English accent"),
        model: FLASH_LITE,
        serviceTier: "flex",
        text: LINES[0].text,
        voice: "Kore",
      },
      {
        instructions: expect.stringContaining("unmistakable Australian English accent"),
        model: FLASH_LITE,
        serviceTier: "flex",
        text: LINES[1].text,
        voice: "Puck",
      },
    ]);
  });

  it("voices a line Flash Lite fails on Flash, in the same voice", async () => {
    generateSpeechWithProviderMock
      .mockResolvedValueOnce(speaks(2))
      .mockResolvedValueOnce({
        audio: createWavAudio({ amplitude: 0, durationSeconds: 2 }),
        providerMetadata: {},
      });

    const { error } = await voiceListeningScript({ language: "en", lines: LINES });

    expect(error).toBeNull();

    expect(
      generateSpeechWithProviderMock.mock.calls.map(([input]) => [input.model, input.voice]),
    ).toStrictEqual([
      [FLASH_LITE, "Kore"],
      [FLASH_LITE, "Puck"],
      [FLASH, "Puck"],
    ]);
  });

  it("fails the recording when a line fails on every model, instead of leaving a gap", async () => {
    generateSpeechWithProviderMock.mockImplementation(async ({ voice }) => {
      if (voice === "Puck") {
        throw new Error("Unavailable");
      }

      return speaks(2);
    });

    const { data, error } = await voiceListeningScript({ language: "en", lines: LINES });

    expect(data).toBeNull();
    expect(error?.message).toBe("Unavailable");
  });
});
