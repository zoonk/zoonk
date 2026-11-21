import { BlobNotFoundError, get, head, put } from "@vercel/blob";
import { createWavAudio } from "@zoonk/ai/tasks/audio/wav-fixture";
import { blobStoreFixture } from "@zoonk/testing/fixtures/blobs";
import { type SpeechResult, generateSpeech } from "ai";
import { vi } from "vitest";

const wav = Buffer.from(createWavAudio({ amplitude: 1000, durationSeconds: 0.1 }));

export const speechResult: SpeechResult = {
  audio: { base64: wav.toString("base64"), format: "wav", mediaType: "audio/wav", uint8Array: wav },
  providerMetadata: {},
  responses: [],
  warnings: [],
};

export function serveListeningAudio() {
  const store = blobStoreFixture(BlobNotFoundError);
  vi.mocked(get).mockImplementation(store.get);
  vi.mocked(head).mockImplementation(store.head);
  vi.mocked(put).mockImplementation(store.put);
  vi.mocked(generateSpeech).mockReset().mockResolvedValue(speechResult);
}
