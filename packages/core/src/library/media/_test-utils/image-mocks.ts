import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/v2/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import sharp from "sharp";
import { vi } from "vitest";

export const TEST_IMAGE_WIDTH = 48;
export const TEST_IMAGE_HEIGHT = 32;

/** A small real WebP with shapes, so the blank-frame check and file storage run for real. */
export function drawTestImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TEST_IMAGE_WIDTH}" height="${TEST_IMAGE_HEIGHT}">
    <rect width="100%" height="100%" fill="#f7f7f9"/>
    <circle cx="24" cy="16" r="10" fill="#8b93f8"/>
    <rect x="4" y="4" width="8" height="8" fill="#f05d5e"/>
  </svg>`;

  return sharp(Buffer.from(svg)).webp().toBuffer();
}

/** One flat color: the kind of broken output the blank-frame check rejects. */
export function drawBlankImage(): Promise<Buffer> {
  return sharp({
    create: {
      background: "#ffffff",
      channels: 3,
      height: TEST_IMAGE_HEIGHT,
      width: TEST_IMAGE_WIDTH,
    },
  })
    .webp()
    .toBuffer();
}

export function testScene(overrides?: Partial<ImageScene>): ImageScene {
  return {
    focalObject: "a price tag showing $80 crossed out",
    labels: [],
    layout: "single",
    motion: null,
    relation: null,
    supportingObjects: [],
    ...overrides,
  };
}

const testImageProvenance = {
  costUsd: 0.01,
  generatedAt: "2026-09-26T12:00:00.000Z",
  latencyMs: 1000,
  model: "openai/gpt-image-2.5-flare",
  promptVersion: "style-v1-test",
  provider: "openai",
  requestedModel: "openai/gpt-image-2.5-flare",
  runId: "test-image-run",
  usage: {},
};

/**
 * Image models are the one external boundary in these tests: the gateway is
 * blocked and real images aren't deterministic. Test files mock the scene,
 * drawing and check task modules with `vi.mock`; scene planning, the blank
 * frame check, identity search, storage rows and links run for real. The
 * results are partial because core reads only these fields of each task.
 */
export function mockImageScene(scene: ImageScene) {
  return vi.mocked(generateImageScene).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Core reads only the scene.
    { data: scene } as Awaited<ReturnType<typeof generateImageScene>>,
  );
}

type DrawnImageResult = Awaited<ReturnType<typeof generateLessonImage>>;
type CheckResult = Awaited<ReturnType<typeof checkLessonImage>>;

function drawnImage(image: Buffer): DrawnImageResult {
  const result = {
    data: { image: { mediaType: "image/webp", uint8Array: new Uint8Array(image) } },
    prompt: "test prompt",
    provenance: testImageProvenance,
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Core reads only the image bytes, their type and the provenance.
  return result as unknown as DrawnImageResult;
}

/** Images in call order. */
export function mockDrawnImages(images: readonly Buffer[]) {
  const mock = vi.mocked(generateLessonImage);
  images.forEach((image) => mock.mockResolvedValueOnce(drawnImage(image)));
  return mock;
}

function checkResult(passed: boolean): CheckResult {
  const result = {
    data: {
      matchesScene: passed,
      onStyle: true,
      passed,
      problems: passed ? [] : ["shows a different object"],
      textCorrect: true,
    },
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Core reads only the verdict.
  return result as CheckResult;
}

/** Verdicts in call order, for images checked one after another. */
export function mockImageChecks(verdicts: readonly boolean[]) {
  const mock = vi.mocked(checkLessonImage);
  verdicts.forEach((passed) => mock.mockResolvedValueOnce(checkResult(passed)));
  return mock;
}

/** Clears queued scenes, images and verdicts between steps of one test. */
export function resetImageModels(): void {
  vi.mocked(generateImageScene).mockReset();
  vi.mocked(generateLessonImage).mockReset();
  vi.mocked(checkLessonImage).mockReset();
}
