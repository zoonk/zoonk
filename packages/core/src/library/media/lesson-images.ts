import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { drawPlannedImage } from "./_utils/draw-planned-image";
import { type ImageAnalytics, planLibraryImage } from "./_utils/plan-library-image";
import { getStepImageRequest, pickSpacedImageSteps } from "./_utils/step-image-request";

/**
 * `reused`: an existing image showed the same scene. `generated`: a new image
 * passed its check. `failed`: two images failed the check, so the screen has
 * no picture. `none`: the screen asks for no picture or already has one.
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

function getLessonContext(lesson: StepForImage["lesson"]): string {
  const chapter = lesson.homeChapter;
  return [chapter?.homeCourse?.title, chapter?.title, lesson.title].filter(Boolean).join(" › ");
}

/**
 * The screens of a lesson that still need their picture. Only screens the
 * writer marked get one, at most one every two screens, and screens that
 * already have a picture are skipped, so retries never draw twice.
 */
export async function listLessonImageSteps({ lessonId }: { lessonId: string }): Promise<string[]> {
  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, id: true, kind: true, mediaAssetId: true, position: true },
    where: { lessonId },
  });

  const requested = steps.filter((step) => getStepImageRequest(step) !== null);

  return pickSpacedImageSteps(requested)
    .filter((step) => !step.mediaAssetId)
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
    data: { mediaAssetId },
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

  const planned = await planLibraryImage({
    analytics,
    category: lesson.homeChapter?.homeCourse?.categories[0]?.category ?? null,
    context: getLessonContext(lesson),
    language: lesson.language,
    ownerId: lesson.visibility === "private" ? lesson.ownerId : null,
    request: request.prompt,
    screenText: request.screenText,
    textAllowed: lesson.targetLanguage === null,
  });

  const asset =
    planned.kind === "existing"
      ? { id: planned.assetId }
      : await drawPlannedImage({ analytics, plan: planned.plan });

  if (!asset) {
    return { status: "failed" };
  }

  await linkStepImage({ lessonId: lesson.id, mediaAssetId: asset.id, stepId });

  return { mediaAssetId: asset.id, status: planned.kind === "existing" ? "reused" : "generated" };
}
