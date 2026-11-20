import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { vi } from "vitest";
import { storeBlobUploads } from "../../../_test-utils/blob-uploads";

export const SPEECH_PROVENANCE = {
  generatedAt: "2026-11-13T12:00:00.000Z",
  latencyMs: 1,
  model: "openai/gpt-voice",
  promptVersion: "test",
  provider: "openai",
  requestedModel: "openai/gpt-voice",
  runId: "speech-run",
  usage: {},
};

export function mockVoice() {
  storeBlobUploads();

  vi.mocked(generateLanguageAudio).mockResolvedValue({
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 900,
      format: "mp3",
      provenance: SPEECH_PROVENANCE,
    },
    error: null,
  });
}
