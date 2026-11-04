import { randomUUID } from "node:crypto";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { checkLessonImage } from "@zoonk/ai/tasks/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/images/scene";
import { describeImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { IMAGE_STYLE_VERSION } from "@zoonk/ai/tasks/images/style";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { pictureCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { buildImageReuseKey } from "@zoonk/utils/identity-key";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { getRun } from "workflow/api";
import { mockHookConflict } from "../../../mocks/workflow";
import { TEST_IMAGE, imageProvenance, passedCheck, sceneFor } from "./_test-utils/image-results";
import { lessonImagesWorkflow } from "./lesson-images-workflow";

function serveStoredPictures() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(TEST_IMAGE, { headers: { "content-type": "image/webp" } })),
  );
}

function explanation(prompt: string) {
  return { image: { alt: `A drawing of a ${prompt}`, prompt }, text: "One idea on this screen." };
}

function markedScreens({ lessonId, prompts }: { lessonId: string; prompts: string[] }) {
  return Promise.all(
    prompts.map((prompt, index) =>
      libraryStepFixture({ content: explanation(prompt), lessonId, position: index }),
    ),
  );
}

function runStatuses(initial: Record<string, string>): Record<string, string> {
  const statuses = { ...initial };

  vi.mocked(getRun).mockImplementation(
    (runId) =>
      ({
        exists: Promise.resolve(true),
        status: Promise.resolve(statuses[runId] ?? "completed"),
      }) as never,
  );

  return statuses;
}

async function linkPicture(stepId?: string) {
  const asset = await mediaAssetFixture();
  await prisma.step.update({ data: { mediaAssetId: asset.id }, where: { id: stepId } });
}

const rejectedCheck = { data: { ...passedCheck.data, passed: false, problems: ["wrong object"] } };

function lessonPictures(lessonId: string) {
  return prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { mediaAssetId: true },
    where: { lessonId },
  });
}

describe(lessonImagesWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        ({ data: { subjects: subjects.map(() => ({ terms: [] })) } }) as never,
    );

    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      Promise.resolve({ data: sceneFor(request) } as never),
    );

    vi.mocked(generateLessonImage).mockResolvedValue({
      data: { image: { mediaType: "image/webp", uint8Array: TEST_IMAGE } },
      prompt: "test prompt",
      provenance: imageProvenance,
    } as never);

    vi.mocked(checkLessonImage).mockResolvedValue(passedCheck as never);

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );

    serveStoredPictures();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows each new picture before its check against its alt, then replaces one its check rejects with a redraw", async () => {
    const lesson = await libraryLessonFixture();
    const [rejectedPrompt, passedPrompt] = [`globe ${randomUUID()}`, `compass ${randomUUID()}`];
    await markedScreens({ lessonId: lesson.id, prompts: [rejectedPrompt, passedPrompt] });

    const isRejected = (scene: { focalObject: string }) =>
      scene.focalObject.includes(rejectedPrompt);

    vi.mocked(checkLessonImage).mockImplementation(async ({ scene }) =>
      isRejected(scene) &&
      vi.mocked(checkLessonImage).mock.calls.filter(([params]) => isRejected(params.scene))
        .length === 1
        ? (rejectedCheck as never)
        : (passedCheck as never),
    );

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 2,
      reused: 0,
    });

    const steps = await prisma.step.findMany({
      include: { mediaAsset: true },
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(checkLessonImage).toHaveBeenCalledTimes(3);

    expect(
      vi.mocked(checkLessonImage).mock.calls.every(([params]) => params.serviceTier === "flex"),
    ).toBe(true);

    const alts = vi.mocked(checkLessonImage).mock.calls.map(([params]) => params.alt);

    expect(alts.filter((alt) => alt === `A drawing of a ${rejectedPrompt}`)).toHaveLength(2);
    expect(alts.filter((alt) => alt === `A drawing of a ${passedPrompt}`)).toHaveLength(1);

    expect(generateImageScene).toHaveBeenLastCalledWith(
      expect.objectContaining({
        alt: `A drawing of a ${rejectedPrompt}`,
        findings: ["wrong object"],
      }),
    );

    expect(generateLessonImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ corrections: ["wrong object"] }),
    );

    const redraw = await vi.mocked(uploadImage).mock.results[2]?.value;

    expect(uploadImage).toHaveBeenCalledTimes(3);
    expect(steps[0]?.mediaAsset?.url).toBe(redraw?.data);
    expect(steps[1]?.mediaAsset?.url).not.toBe(redraw?.data);
  });

  it("takes a picture out of use when its one redraw fails its check too", async () => {
    const lesson = await libraryLessonFixture();
    await markedScreens({ lessonId: lesson.id, prompts: [`kidney ${randomUUID()}`] });
    vi.mocked(checkLessonImage).mockResolvedValue(rejectedCheck as never);

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 1,
      reused: 0,
    });

    expect(generateLessonImage).toHaveBeenCalledTimes(2);
    expect(checkLessonImage).toHaveBeenCalledTimes(2);
    await expect(lessonPictures(lesson.id)).resolves.toStrictEqual([{ mediaAssetId: null }]);
  });

  it("checks the redraw of a lesson's opening scene like any picture's", async () => {
    const lesson = await libraryLessonFixture();
    const alt = `Fábio corta a mão numa lata ${randomUUID()}`;

    await libraryStepFixture({
      content: {
        image: { alt, prompt: "A hand with a small cut" },
        text: "Fábio corta a mão.",
        variant: "text",
      },
      kind: "hook",
      lessonId: lesson.id,
    });

    vi.mocked(checkLessonImage).mockResolvedValue(rejectedCheck as never);

    await lessonImagesWorkflow({ lessonId: lesson.id });

    expect(checkLessonImage).toHaveBeenCalledTimes(2);
    expect(generateLessonImage).toHaveBeenCalledTimes(2);

    expect(generateImageScene).toHaveBeenLastCalledWith(
      expect.objectContaining({ alt, findings: ["wrong object"] }),
    );

    await expect(lessonPictures(lesson.id)).resolves.toStrictEqual([{ mediaAssetId: null }]);
  });

  it("waits for the images run already drawing the lesson, then draws only what it left", async () => {
    const lesson = await libraryLessonFixture();

    const [drawnByOther, left] = await markedScreens({
      lessonId: lesson.id,
      prompts: [`atlas ${randomUUID()}`, `sextant ${randomUUID()}`],
    });

    const statuses = runStatuses({ "drawing-run": "running" });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "drawing-run" });

    vi.mocked(sleep).mockImplementationOnce(async () => {
      await linkPicture(drawnByOther?.id);
      statuses["drawing-run"] = "completed";
      mockHookConflict(null);
    });

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 1,
      reused: 0,
    });

    expect(sleep).toHaveBeenCalledOnce();
    expect(generateLessonImage).toHaveBeenCalledOnce();

    await expect(prisma.step.findUniqueOrThrow({ where: { id: left?.id } })).resolves.toMatchObject(
      { mediaAssetId: expect.any(String) },
    );
  });

  it("takes its turn after another waiting run that took the token first, drawing nothing it drew", async () => {
    const lesson = await libraryLessonFixture();

    const [missing] = await markedScreens({
      lessonId: lesson.id,
      prompts: [`quill ${randomUUID()}`],
    });

    const statuses = runStatuses({ "drawing-run": "running", "waiting-run": "running" });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "drawing-run" });

    vi.mocked(sleep)
      .mockImplementationOnce(async () => {
        statuses["drawing-run"] = "completed";
        mockHookConflict({ returnValue: Promise.resolve(null), runId: "waiting-run" });
      })
      .mockImplementationOnce(async () => {
        await linkPicture(missing?.id);
        statuses["waiting-run"] = "completed";
        mockHookConflict(null);
      });

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 0,
      reused: 0,
    });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(generateLessonImage).not.toHaveBeenCalled();
  });

  it("reuses a picture of the same scene and draws the rest", async () => {
    const [reusedPrompt, drawnPrompt] = [`scale ${randomUUID()}`, `coin ${randomUUID()}`];
    const reusedScene = sceneFor(reusedPrompt);

    const [lesson, existing] = await Promise.all([
      libraryLessonFixture(),
      mediaAssetFixture({
        prompt: describeImageScene(reusedScene),
        reuseKey: buildImageReuseKey({
          canvas: "landscape",
          language: null,
          prompt: describeImageScene(reusedScene),
        }),
        styleVersion: IMAGE_STYLE_VERSION,
      }),
    ]);

    const [reusedStep, drawnStep] = await Promise.all([
      libraryStepFixture({ content: explanation(reusedPrompt), lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ content: explanation(drawnPrompt), lessonId: lesson.id, position: 2 }),
    ]);

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 1,
      reused: 1,
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { id: { in: [reusedStep.id, drawnStep.id] } },
    });

    expect(steps[0]?.mediaAssetId).toBe(existing.id);
    expect(steps[1]?.mediaAssetId).toStrictEqual(expect.any(String));
    expect(generateLessonImage).toHaveBeenCalledOnce();

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 0,
      reused: 0,
    });
  });

  it("draws a picture for each option of a question whose options are pictures, and checks each", async () => {
    const lesson = await libraryLessonFixture();
    const drawing = randomUUID();

    const content = {
      ...pictureCheckContent,
      options: pictureCheckContent.options.map((option) => ({
        ...option,
        picture: { ...option.picture, prompt: `${option.picture.prompt} ${drawing}` },
      })),
    };

    const step = await libraryStepFixture({ content, kind: "check", lessonId: lesson.id });

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 3,
      reused: 0,
    });

    const pictures = await prisma.stepOptionPicture.findMany({
      orderBy: { optionId: "asc" },
      where: { stepId: step.id },
    });

    expect(pictures.map((picture) => picture.optionId)).toStrictEqual([
      "baroque",
      "gothic",
      "romanesque",
    ]);

    expect(new Set(pictures.map((picture) => picture.mediaAssetId)).size).toBe(3);
    expect(checkLessonImage).toHaveBeenCalledTimes(3);

    await expect(prisma.step.findUnique({ where: { id: step.id } })).resolves.toMatchObject({
      mediaAssetId: null,
    });

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 0,
      reused: 0,
    });
  });

  it("draws the other screens when one screen's picture fails, and the next run draws only that one", async () => {
    const lesson = await libraryLessonFixture();
    const [failingPrompt, drawnPrompt] = [`prism ${randomUUID()}`, `lens ${randomUUID()}`];
    await markedScreens({ lessonId: lesson.id, prompts: [failingPrompt, drawnPrompt] });

    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      request === failingPrompt
        ? Promise.reject(new Error("Provider unavailable"))
        : Promise.resolve({ data: sceneFor(request) } as never),
    );

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 1,
      generated: 1,
      reused: 0,
    });

    const [failed, drawn] = await lessonPictures(lesson.id);

    expect(failed?.mediaAssetId).toBeNull();
    expect(drawn?.mediaAssetId).toStrictEqual(expect.any(String));

    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      Promise.resolve({ data: sceneFor(request) } as never),
    );

    vi.mocked(generateLessonImage).mockClear();

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 1,
      reused: 0,
    });

    expect(generateLessonImage).toHaveBeenCalledOnce();

    await expect(lessonPictures(lesson.id)).resolves.toStrictEqual([
      { mediaAssetId: expect.any(String) },
      drawn,
    ]);
  });
});
