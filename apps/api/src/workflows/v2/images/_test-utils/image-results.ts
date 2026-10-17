import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";

/** A 16x12 WebP with shapes, so the blank-frame check and file storage run for real. */
export const TEST_IMAGE = new Uint8Array(
  Buffer.from(
    "UklGRogAAABXRUJQVlA4IHwAAACQAgCdASoQAAwAAUAmJbACdDBIyIT3QBnLPA4RAAD+93CMR3dn3SJPZUu7fZw0AxFnilKdKiIcuDDTD/Y9/+Z/6lYW1UFu4BVa9V2LgqxJHX6e42lH7eO2M9AHLK06ebWDHxVLNdkn58gdZeZlXJ4m51P8/zwZxJfCAAAA",
    "base64",
  ),
);

export const imageProvenance = {
  costUsd: 0.004,
  generatedAt: "2026-09-26T12:00:00.000Z",
  latencyMs: 1000,
  model: "openai/gpt-image-2.5-flare",
  promptVersion: "style-v1-test",
  provider: "openai",
  requestedModel: "openai/gpt-image-2.5-flare",
  runId: "test-image-run",
  usage: {},
};

export const passedCheck = {
  data: { matchesScene: true, onStyle: true, passed: true, problems: [], textCorrect: true },
};

/** A different scene for every request, so each image gets its own reuse key. */
export function sceneFor(request: string): ImageScene {
  return {
    focalObject: `a drawing of ${request}`,
    labels: [],
    layout: "single",
    motion: null,
    relation: null,
    supportingObjects: [],
  };
}
