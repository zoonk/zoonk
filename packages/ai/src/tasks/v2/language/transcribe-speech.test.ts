import { transcribe } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeSpeech } from "./transcribe-speech";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

// Transcription models are paid external services; the real `transcribe` only runs in the test that checks direct OpenAI calls stay blocked.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();

  return { ...actual, transcribe: vi.fn() };
});

const AUDIO = new Uint8Array([1, 2, 3]);

function heard(text: string) {
  return { text } as Awaited<ReturnType<typeof transcribe>>;
}

/** Each call's model as `provider:modelId`, in the order they were tried. */
function triedModels(): string[] {
  return vi
    .mocked(transcribe)
    .mock.calls.map(([{ model }]) =>
      typeof model === "string" ? model : `${model.provider}:${model.modelId}`,
    );
}

describe(transcribeSpeech, () => {
  beforeEach(() => {
    vi.mocked(transcribe).mockReset();
  });

  it("sends the recording straight to OpenAI's gpt-transcribe with the language hint and verbatim context", async () => {
    vi.mocked(transcribe).mockResolvedValueOnce(heard(" Eu quero mas café. "));

    const result = await transcribeSpeech({ audio: AUDIO, language: "pt-BR" });

    expect(result.data).toStrictEqual({ text: "Eu quero mas café." });
    expect(triedModels()).toStrictEqual(["openai.transcription:gpt-transcribe"]);

    expect(vi.mocked(transcribe).mock.calls[0]?.[0].providerOptions).toStrictEqual({
      openai: {
        language: "pt",
        prompt: expect.stringContaining("Never correct them"),
        responseFormat: "json",
      },
    });

    expect(result.provenance).toMatchObject({
      model: "openai/gpt-transcribe",
      provider: "openai",
      requestedModel: "openai/gpt-transcribe",
    });
  });

  it("falls back to gpt-4o-transcribe through the gateway, then Gemini, when OpenAI fails", async () => {
    vi.mocked(transcribe)
      .mockRejectedValueOnce(new Error("OpenAI is down"))
      .mockRejectedValueOnce(new Error("Gateway is down"))
      .mockResolvedValueOnce(heard("Tengo un pero"));

    const result = await transcribeSpeech({ audio: AUDIO, language: "es" });

    expect(triedModels()).toStrictEqual([
      "openai.transcription:gpt-transcribe",
      "gateway:openai/gpt-4o-transcribe",
      "gateway:google/gemini-3.5-transcribe",
    ]);

    // Gemini detects the language itself and takes no OpenAI options.
    expect(vi.mocked(transcribe).mock.calls[2]?.[0].providerOptions).toBeUndefined();

    expect(result.data).toStrictEqual({ text: "Tengo un pero" });

    expect(result.provenance).toMatchObject({
      model: "google/gemini-3.5-transcribe",
      requestedModel: "openai/gpt-transcribe",
    });
  });

  it("keeps a requested gateway model and falls back only to Gemini", async () => {
    vi.mocked(transcribe)
      .mockRejectedValueOnce(new Error("Gateway is down"))
      .mockResolvedValueOnce(heard("I sink it's cheap"));

    await transcribeSpeech({ audio: AUDIO, language: "en", model: "openai/gpt-4o-transcribe" });

    expect(triedModels()).toStrictEqual([
      "gateway:openai/gpt-4o-transcribe",
      "gateway:google/gemini-3.5-transcribe",
    ]);
  });

  it("never lets a direct OpenAI call leave the process during tests", async () => {
    const actual = await vi.importActual<typeof Ai>("ai");
    vi.mocked(transcribe).mockImplementationOnce(actual.transcribe);

    await expect(
      transcribeSpeech({ audio: AUDIO, language: "en", useFallback: false }),
    ).rejects.toThrow("Direct provider calls are disabled during tests.");
  });
});
