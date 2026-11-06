import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateImageScene } from "@zoonk/ai/tasks/images/scene";
import {
  type ImageScene,
  describeImageScene,
  imageSceneSchema,
} from "@zoonk/ai/tasks/images/scene-schema";
import { type ImageCanvas, getImagePalette } from "@zoonk/ai/tasks/images/style";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { logInfo } from "@zoonk/utils/logger";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag, getMediaAssetCacheTag } from "../../cache/tags";
import { readStoredImage } from "../../images/read-stored-image";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { drawImage, reviewImage } from "./_utils/draw-image";
import { type ImageAnalytics } from "./_utils/draw-library-image";
import { uploadImageFile } from "./_utils/save-image-asset";

const CHECK_TIER = chooseServiceTier({ wait: "later" });

const OWED_PICTURES_PER_SWEEP = 100;
const STORING_STEP_CHECKS_WITHIN_MS = 3_600_000;
const SWEEPS_GIVE_UP_AFTER_MS = 7 * MS_PER_DAY;

export type PictureRedraw = Awaited<ReturnType<typeof uploadImageFile>> & {
  provenance: LibraryProvenance;
  reuseKey: string;
  scene: ImageScene;
};

export type ImageAssetCheck =
  | { status: "missing" | "passed" }
  | { status: "rejected"; findings: string[] };

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

async function readAsset(assetId: string): Promise<CheckedAsset> {
  const asset = await findAsset(assetId);

  if (!asset) {
    throw new Error(`The picture ${assetId} is gone.`);
  }

  return asset;
}

function getAssetLanguage(asset: CheckedAsset): string {
  return asset.language ?? "en";
}

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

/** Internal workflow bridge: checks the stored picture, or its `redraw` before it's shown. */
export async function checkImageAsset({
  alt,
  analytics,
  assetId,
  redraw,
}: {
  /** The alt of the screen the picture was drawn for. */
  alt?: string | null;
  analytics?: ImageAnalytics;
  assetId: string;
  redraw?: PictureRedraw;
}): Promise<ImageAssetCheck> {
  const asset = await findAsset(assetId);

  if (!asset) {
    return { status: "missing" };
  }

  const review = await reviewImage({
    alt,
    analytics,
    image: await readStoredImage({ url: redraw?.url ?? asset.url }),
    language: getAssetLanguage(asset),
    scene: redraw?.scene ?? asset.scene,
    serviceTier: CHECK_TIER,
  });

  if (!review.usable) {
    return { findings: review.problems, status: "rejected" };
  }

  if (!redraw) {
    await prisma.mediaAsset.updateMany({ data: { checkOwedAt: null }, where: { id: assetId } });
  }

  return { status: "passed" };
}

/**
 * A picture that fails its check usually followed a plan that contradicts its alt, so redrawing
 * that plan fails the same way. Labels stay as they were: screens and questions point at them.
 */
export async function planImageAssetAgain({
  alt,
  analytics,
  assetId,
  findings,
}: {
  alt?: string | null;
  analytics?: ImageAnalytics;
  assetId: string;
  findings: string[];
}): Promise<ImageScene> {
  const asset = await readAsset(assetId);

  const { data } = await generateImageScene({
    alt,
    analytics,
    findings,
    language: getAssetLanguage(asset),
    request: alt ?? describeImageScene(asset.scene),
    textAllowed: asset.scene.labels.length > 0,
  });

  return { ...data, labels: asset.scene.labels };
}

/** Throws on a blank frame, so the step drawing it retries. The redraw is stored, not yet shown. */
export async function redrawImageAsset({
  analytics,
  assetId,
  findings,
  scene,
}: {
  analytics?: ImageAnalytics;
  assetId: string;
  findings: string[];
  scene: ImageScene;
}): Promise<PictureRedraw> {
  const asset = await readAsset(assetId);

  const drawn = await drawImage({
    analytics,
    attempts: 1,
    canvas: getAssetCanvas(asset),
    corrections: findings,
    language: getAssetLanguage(asset),
    palette: getImagePalette(asset.palette),
    scene,
  });

  if (!drawn) {
    throw new Error(`The redraw of picture ${assetId} was a blank frame.`);
  }

  const file = await uploadImageFile({ image: drawn.image, ownerId: asset.ownerId });

  return {
    ...file,
    provenance: drawn.provenance,
    // The old key names the scene that was planned away, and no request makes this one, so only
    // search, which reads the new prompt, reuses the redraw.
    reuseKey: scopeIdentityKey({ key: `image:replanned:${assetId}`, ownerId: asset.ownerId }),
    scene,
  };
}

export async function replaceImageAsset({
  assetId,
  redraw,
}: {
  assetId: string;
  redraw: PictureRedraw;
}): Promise<void> {
  const lessonTags = await findLessonTags(assetId);
  const now = new Date();

  await prisma.$transaction([
    prisma.mediaAsset.updateMany({
      data: {
        ...toProvenanceData(redraw.provenance),
        checkOwedAt: null,
        height: redraw.height,
        prompt: describeImageScene(redraw.scene),
        reuseKey: redraw.reuseKey,
        scene: redraw.scene,
        url: redraw.url,
        width: redraw.width,
      },
      where: { id: assetId },
    }),
    prisma.step.updateMany({ data: { updatedAt: now }, where: usesPicture(assetId) }),
    prisma.item.updateMany({ data: { updatedAt: now }, where: { mediaAssetId: assetId } }),
  ]);

  revalidateCacheTags([getMediaAssetCacheTag(assetId), ...lessonTags]);
}

/**
 * Internal bridge for the daily sweep. A picture owed for over a week kept failing its check, so the
 * sweep stops paying for it.
 */
export async function listOwedPictureChecks(): Promise<string[]> {
  const now = Date.now();

  const pictures = await prisma.mediaAsset.findMany({
    orderBy: { checkOwedAt: "desc" },
    select: { id: true },
    take: OWED_PICTURES_PER_SWEEP,
    where: {
      checkOwedAt: {
        gte: new Date(now - SWEEPS_GIVE_UP_AFTER_MS),
        lt: new Date(now - STORING_STEP_CHECKS_WITHIN_MS),
      },
    },
  });

  return pictures.map((picture) => picture.id);
}

/** Drops the questions about the picture, since they can't be asked without it. */
export async function removeImageAsset({ assetId }: { assetId: string }): Promise<void> {
  const lessonTags = await findLessonTags(assetId);
  logInfo("[images] Picture taken out of use without a redraw that passed its check", { assetId });

  await writePlanInputs(async (tx) => {
    const questions = await tx.item.findMany({
      select: { examBlueprintId: true, skillId: true },
      where: { mediaAssetId: assetId },
    });

    await lockPlanSourceWrite(tx, {
      blueprintIds: [...new Set(questions.flatMap(({ examBlueprintId }) => examBlueprintId ?? []))],
      skillIds: [...new Set(questions.map(({ skillId }) => skillId))],
    });

    await tx.item.deleteMany({ where: { mediaAssetId: assetId } });

    await tx.step.updateMany({
      data: { updatedAt: new Date() },
      where: { optionPictures: { some: { mediaAssetId: assetId } } },
    });

    await tx.step.updateMany({
      data: { mediaAssetId: null, pictureAvailableAt: null },
      where: { mediaAssetId: assetId },
    });

    await tx.mediaAsset.deleteMany({ where: { id: assetId } });
  });

  revalidateCacheTags([getMediaAssetCacheTag(assetId), ...lessonTags]);
}
