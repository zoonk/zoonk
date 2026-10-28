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

/** Internal workflow bridge, not an app authorization boundary. */
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

export type OptionPictureTarget = { optionId: string; stepId: string };

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

/** Internal workflow bridge, not an app authorization boundary. */
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
