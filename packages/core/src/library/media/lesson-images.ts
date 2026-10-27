import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import {
  type ImageAnalytics,
  type LibraryPicture,
  drawLibraryImage,
} from "./_utils/draw-library-image";
import { getOptionPictureRequests, getStepImageRequest } from "./_utils/step-image-request";

/**
 * `reused`: an existing image showed the same scene. `generated`: a new image
 * passed its check. `failed`: two images failed the check, or a private
 * lesson's picture has no store to go to, so the screen has no picture.
 * `none`: the screen asks for no picture or already has one.
 */
export type StepImageOutcome =
  | { status: "generated" | "reused"; mediaAssetId: string }
  | { status: "failed" | "none" };

const categorySelect = {
  orderBy: { createdAt: "asc" },
  select: { category: true },
  take: 1,
} as const;

function findStepForImage(stepId: string) {
  return prisma.step.findUnique({
    include: {
      lesson: {
        select: {
          homeChapter: {
            select: {
              homeCourse: { select: { categories: categorySelect, title: true } },
              title: true,
            },
          },
          id: true,
          language: true,
          ownerId: true,
          targetLanguage: true,
          title: true,
          visibility: true,
        },
      },
    },
    where: { id: stepId },
  });
}

type StepForImage = NonNullable<Awaited<ReturnType<typeof findStepForImage>>>;

/** Where a lesson's picture sits; a private lesson's pictures are its owner's, a shared one's shared. */
function getLessonPictureScope(lesson: StepForImage["lesson"]) {
  const chapter = lesson.homeChapter;

  return {
    category: chapter?.homeCourse?.categories[0]?.category ?? null,
    context: [chapter?.homeCourse?.title, chapter?.title, lesson.title].filter(Boolean).join(" › "),
    language: lesson.language,
    ownerId: lesson.visibility === "private" ? lesson.ownerId : null,
  };
}

function toOutcome(picture: LibraryPicture): StepImageOutcome {
  return { mediaAssetId: picture.assetId, status: picture.drawn ? "generated" : "reused" };
}

/**
 * The screens of a lesson whose picture isn't drawn yet, in screen order. Every picture a screen
 * asks for is one it needs, so all of them are drawn; screens that already have one are skipped,
 * so retries never draw twice.
 */
export async function listLessonImageSteps({ lessonId }: { lessonId: string }): Promise<string[]> {
  const lesson = await prisma.lesson.findUnique({
    select: {
      steps: {
        orderBy: { position: "asc" },
        select: { content: true, id: true, kind: true, mediaAssetId: true },
        where: CURRENT_STEPS,
      },
    },
    where: { id: lessonId },
  });

  return (lesson?.steps ?? [])
    .filter((step) => !step.mediaAssetId && getStepImageRequest(step))
    .map((step) => step.id);
}

async function linkStepImage({
  lessonId,
  mediaAssetId,
  stepId,
}: {
  lessonId: string;
  mediaAssetId: string;
  stepId: string;
}): Promise<void> {
  await prisma.step.updateMany({
    data: { mediaAssetId, pictureAvailableAt: new Date() },
    where: { id: stepId, mediaAssetId: null },
  });

  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
}

/**
 * Gives one lesson screen its picture: a structured scene, an existing image
 * of the same scene when there is one, or a new image that passed its check.
 * Language courses get pictures without text, and a private lesson's picture
 * stays private. The alt text stays on the screen, written in its language.
 *
 * This is a workflow bridge, not an app authorization boundary: it runs for
 * Library content that a workflow is already generating.
 */
export async function createStepImage({
  analytics,
  stepId,
}: {
  analytics?: ImageAnalytics;
  stepId: string;
}): Promise<StepImageOutcome> {
  const step = await findStepForImage(stepId);
  const request = step && !step.mediaAssetId ? getStepImageRequest(step) : null;

  if (!step || !request) {
    return { status: "none" };
  }

  const { lesson } = step;

  const picture = await drawLibraryImage({
    ...getLessonPictureScope(lesson),
    analytics,
    numberedParts: request.parts,
    request: request.prompt,
    screenText: request.screenText,
    textAllowed: lesson.targetLanguage === null,
  });

  if (!picture) {
    return { status: "failed" };
  }

  await linkStepImage({ lessonId: lesson.id, mediaAssetId: picture.assetId, stepId });

  return toOutcome(picture);
}

/** One option of one question, whose picture isn't drawn yet. */
export type OptionPictureTarget = { optionId: string; stepId: string };

/**
 * The options of a lesson's questions whose pictures aren't drawn yet, in screen order: each
 * picture option asks for one, drawn alone. Options that have one are skipped, so retries never
 * draw twice.
 */
export async function listLessonOptionPictures({
  lessonId,
}: {
  lessonId: string;
}): Promise<OptionPictureTarget[]> {
  const lesson = await prisma.lesson.findUnique({
    select: {
      steps: {
        orderBy: { position: "asc" },
        select: {
          content: true,
          id: true,
          kind: true,
          optionPictures: { select: { optionId: true } },
        },
        where: { ...CURRENT_STEPS, kind: "check" },
      },
    },
    where: { id: lessonId },
  });

  return (lesson?.steps ?? []).flatMap((step) => {
    const drawn = new Set(step.optionPictures.map((picture) => picture.optionId));

    return getOptionPictureRequests(step)
      .filter((request) => !drawn.has(request.optionId))
      .map((request) => ({ optionId: request.optionId, stepId: step.id }));
  });
}

/**
 * Gives one option of a question its picture, drawn alone and without text (its name would give
 * the answer away), or an existing image of the same scene. Like a screen's picture, it's planned
 * as a structured scene, a private lesson's stays private, and its check follows in the
 * background.
 *
 * This is a workflow bridge, not an app authorization boundary: it runs for Library content that
 * a workflow is already generating.
 */
export async function createStepOptionPicture({
  analytics,
  optionId,
  stepId,
}: OptionPictureTarget & { analytics?: ImageAnalytics }): Promise<StepImageOutcome> {
  const [step, existing] = await Promise.all([
    findStepForImage(stepId),
    prisma.stepOptionPicture.findUnique({
      select: { mediaAssetId: true },
      where: { stepId_optionId: { optionId, stepId } },
    }),
  ]);

  const request = step
    ? getOptionPictureRequests(step).find((item) => item.optionId === optionId)
    : null;

  if (!step || !request || existing) {
    return { status: "none" };
  }

  const { lesson } = step;

  const picture = await drawLibraryImage({
    ...getLessonPictureScope(lesson),
    analytics,
    request: request.prompt,
    screenText: request.screenText,
    textAllowed: false,
  });

  if (!picture) {
    return { status: "failed" };
  }

  await prisma.stepOptionPicture.createMany({
    data: { mediaAssetId: picture.assetId, optionId, stepId },
    skipDuplicates: true,
  });

  revalidateCacheTags([getLibraryLessonCacheTag(lesson.id)]);

  return toOutcome(picture);
}
