import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateImageScene } from "@zoonk/ai/tasks/images/scene";
import {
  type ImageScene,
  describeImageScene,
  imageSceneSchema,
} from "@zoonk/ai/tasks/images/scene-schema";
import { type ImageCanvas, type ImagePalette, getImagePalette } from "@zoonk/ai/tasks/images/style";
import { prisma } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag, getMediaAssetCacheTag } from "../../cache/tags";
import { readStoredImage } from "../../images/read-stored-image";
import { toProvenanceData } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import {
  type DrawnImage,
  drawCheckedImage,
  drawImage,
  reviewImage,
} from "./_utils/draw-checked-image";
import { type ImageAnalytics } from "./_utils/draw-library-image";
import { uploadImageFile } from "./_utils/save-image-asset";

export type ImageAssetCheck = { status: "missing" | "passed" | "removed" | "replaced" };

const CHECK_TIER = chooseServiceTier({ wait: "later" });

async function findAsset(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({
    select: {
      height: true,
      id: true,
      language: true,
      ownerId: true,
      palette: true,
      scene: true,
      url: true,
      width: true,
    },
    where: { id: assetId },
  });

  const scene = imageSceneSchema.safeParse(asset?.scene);
  return asset && scene.success ? { ...asset, scene: scene.data } : null;
}

type CheckedAsset = NonNullable<Awaited<ReturnType<typeof findAsset>>>;

function getAssetCanvas({ height, width }: Pick<CheckedAsset, "height" | "width">): ImageCanvas {
  return width !== null && width === height ? "square" : "landscape";
}

function usesPicture(assetId: string) {
  return {
    OR: [{ mediaAssetId: assetId }, { optionPictures: { some: { mediaAssetId: assetId } } }],
  };
}

async function findLessonTags(assetId: string): Promise<string[]> {
  const steps = await prisma.step.findMany({
    distinct: ["lessonId"],
    select: { lessonId: true },
    where: usesPicture(assetId),
  });

  return steps.map((step) => getLibraryLessonCacheTag(step.lessonId));
}

type RedrawnImage = DrawnImage & { scene: ImageScene };

async function replacePicture({ asset, drawn }: { asset: CheckedAsset; drawn: RedrawnImage }) {
  const file = await uploadImageFile({ image: drawn.image, ownerId: asset.ownerId });
  const now = new Date();

  await prisma.$transaction([
    prisma.mediaAsset.update({
      data: {
        ...file,
        ...toProvenanceData(drawn.provenance),
        prompt: describeImageScene(drawn.scene),
        scene: drawn.scene,
      },
      where: { id: asset.id },
    }),
    prisma.step.updateMany({ data: { updatedAt: now }, where: usesPicture(asset.id) }),
    prisma.item.updateMany({ data: { updatedAt: now }, where: { mediaAssetId: asset.id } }),
  ]);
}

async function removePicture(asset: CheckedAsset) {
  await writePlanInputs(async (tx) => {
    const questions = await tx.item.findMany({
      select: { examBlueprintId: true, skillId: true },
      where: { mediaAssetId: asset.id },
    });

    await lockPlanSourceWrite(tx, {
      blueprintIds: [...new Set(questions.flatMap(({ examBlueprintId }) => examBlueprintId ?? []))],
      skillIds: [...new Set(questions.map(({ skillId }) => skillId))],
    });

    await tx.item.deleteMany({ where: { mediaAssetId: asset.id } });

    await tx.step.updateMany({
      data: { updatedAt: new Date() },
      where: { optionPictures: { some: { mediaAssetId: asset.id } } },
    });

    await tx.step.updateMany({
      data: { mediaAssetId: null, pictureAvailableAt: null },
      where: { mediaAssetId: asset.id },
    });

    await tx.mediaAsset.delete({ where: { id: asset.id } });
  });
}

/** Every scene shows a picture, so a scene's picture is replaced and never taken out of use. */
async function showsScene(assetId: string): Promise<boolean> {
  const scene = await prisma.step.findFirst({
    select: { id: true },
    where: {
      ...CURRENT_STEPS,
      content: { equals: "text", path: ["variant"] },
      kind: "hook",
      mediaAssetId: assetId,
    },
  });

  return scene !== null;
}

type Redraw = {
  alt?: string | null;
  analytics?: ImageAnalytics;
  asset: CheckedAsset;
  canvas: ImageCanvas;
  language: string;
  palette: ImagePalette;
};

/**
 * A picture that fails its check usually followed a plan that contradicts its alt, so redrawing
 * that plan fails the same way. Labels stay as they were: screens and questions point at them.
 */
async function planSceneAgain({
  alt,
  analytics,
  asset,
  findings,
  language,
}: Redraw & { findings: string[] }): Promise<ImageScene> {
  const { data } = await generateImageScene({
    alt,
    analytics,
    findings,
    language,
    request: alt ?? describeImageScene(asset.scene),
    textAllowed: asset.scene.labels.length > 0,
  });

  return { ...data, labels: asset.scene.labels };
}

/**
 * A scene's last resort: its people and place alone, with no text and no detail its alt could
 * contradict, so it isn't held to the alt and the scene always keeps a picture.
 */
async function drawSceneSetting({
  alt,
  analytics,
  asset,
  canvas,
  language,
  palette,
}: Redraw): Promise<RedrawnImage | null> {
  const { data: scene } = await generateImageScene({
    alt: null,
    analytics,
    language,
    request: `Only the people and the place of this moment, seen whole from a few steps away, with nothing shown up close: ${alt ?? describeImageScene(asset.scene)}`,
    textAllowed: false,
  });

  const drawn = await drawImage({ analytics, canvas, language, palette, scene });
  return drawn && { ...drawn, scene };
}

async function redraw({
  findings,
  ...input
}: Redraw & { findings: string[] }): Promise<RedrawnImage | null> {
  const [scene, isScene] = await Promise.all([
    planSceneAgain({ ...input, findings }),
    showsScene(input.asset.id),
  ]);

  const checked = await drawCheckedImage({
    alt: input.alt,
    analytics: input.analytics,
    attempts: isScene ? 1 : undefined,
    canvas: input.canvas,
    corrections: findings,
    language: input.language,
    palette: input.palette,
    scene,
    serviceTier: CHECK_TIER,
  });

  if (checked) {
    return { ...checked, scene };
  }

  return isScene ? drawSceneSetting(input) : null;
}

/** Internal workflow bridge for pictures drawn by an existing generation workflow. */
export async function checkImageAsset({
  alt,
  analytics,
  assetId,
}: {
  /** The alt of the screen the picture was drawn for. */
  alt?: string | null;
  analytics?: ImageAnalytics;
  assetId: string;
}): Promise<ImageAssetCheck> {
  const asset = await findAsset(assetId);

  if (!asset) {
    return { status: "missing" };
  }

  const language = asset.language ?? "en";
  const image = await readStoredImage({ url: asset.url });

  const review = await reviewImage({
    alt,
    analytics,
    image,
    language,
    scene: asset.scene,
    serviceTier: CHECK_TIER,
  });

  if (review.usable) {
    return { status: "passed" };
  }

  const drawn = await redraw({
    alt,
    analytics,
    asset,
    canvas: getAssetCanvas(asset),
    findings: review.problems,
    language,
    palette: getImagePalette(asset.palette),
  });

  const lessonTags = await findLessonTags(asset.id);

  if (drawn) {
    await replacePicture({ asset, drawn });
  } else {
    logInfo("[images] Picture taken out of use after its redraws failed", { assetId });
    await removePicture(asset);
  }

  revalidateCacheTags([getMediaAssetCacheTag(asset.id), ...lessonTags]);

  return { status: drawn ? "replaced" : "removed" };
}
