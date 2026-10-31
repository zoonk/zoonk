import { BLOCKED_TEST_CALL } from "@zoonk/utils/blocked-test-call";
import { transcribe } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCallCostUsd } from "../../pricing/call-cost";
import { transcribeSpeech } from "./transcribe-speech";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

// Transcription models are paid external services; the real `transcribe` only runs in the test that checks gateway calls stay blocked.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();

  return { ...actual, transcribe: vi.fn() };
});

const AUDIO = new Uint8Array([1, 2, 3]);

function heard(
  text: string,
  result: { durationInSeconds?: number; providerMetadata?: Record<string, unknown> } = {},
) {
  return { providerMetadata: {}, text, ...result } as Awaited<ReturnType<typeof transcribe>>;
}

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

  it("asks gpt-transcribe for verbatim words in the learner's language, away from providers that train on them", async () => {
    vi.mocked(transcribe).mockResolvedValueOnce(heard(" Eu quero mas café. "));

    const result = await transcribeSpeech({ audio: AUDIO, language: "pt-BR" });

    expect(result.data).toStrictEqual({ text: "Eu quero mas café." });
    expect(triedModels()).toStrictEqual(["gateway:openai/gpt-transcribe"]);

    expect(vi.mocked(transcribe).mock.calls[0]?.[0].providerOptions).toStrictEqual({
      azure: { locales: ["pt"] },
      gateway: { disallowPromptTraining: true },
      openai: { language: "pt", prompt: expect.stringContaining("Never correct them") },
    });

    expect(result.provenance).toMatchObject({
      model: "openai/gpt-transcribe",
      provider: "openai",
      requestedModel: "openai/gpt-transcribe",
    });
  });

  it("prices the audio by length and records the credential the gateway used", async () => {
    vi.mocked(transcribe).mockResolvedValueOnce(
      heard("How much is the hint?", {
        durationInSeconds: 60,
        providerMetadata: {
          gateway: {
            routing: {
              finalProvider: "openai",
              modelAttempts: [
                {
                  canonicalSlug: "openai/gpt-transcribe",
                  providerAttempts: [{ credentialType: "byok", success: true }],
                  success: true,
                },
              ],
            },
          },
        },
      }),
    );

    const { provenance } = await transcribeSpeech({ audio: AUDIO, language: "en" });

    expect(provenance).toMatchObject({
      costUsd: computeCallCostUsd({ model: "openai/gpt-transcribe", usage: { audioSeconds: 60 } }),
      credential: "byok",
      model: "openai/gpt-transcribe",
      provider: "openai",
      usage: { audioSeconds: 60 },
    });
  });

  it("transcribes with the requested model", async () => {
    vi.mocked(transcribe).mockResolvedValueOnce(heard("Tengo un pero"));

    const result = await transcribeSpeech({
      audio: AUDIO,
      language: "es",
      model: "google/gemini-3.5-transcribe",
    });

    expect(triedModels()).toStrictEqual(["gateway:google/gemini-3.5-transcribe"]);
    expect(result.provenance).toMatchObject({ model: "google/gemini-3.5-transcribe" });
  });

  it("never lets a gateway call leave the process during tests", async () => {
    const actual = await vi.importActual<typeof Ai>("ai");
    vi.mocked(transcribe).mockImplementationOnce(actual.transcribe);

    await expect(transcribeSpeech({ audio: AUDIO, language: "en" })).rejects.toThrow(
      BLOCKED_TEST_CALL,
    );
  });
});
