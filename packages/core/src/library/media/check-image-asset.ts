import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { imageSceneSchema } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
import { prisma } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag, getMediaAssetCacheTag } from "../../cache/tags";
import { readStoredImage } from "../../images/read-stored-image";
import { toProvenanceData } from "../_utils/library-rows";
import { type DrawnImage, drawCheckedImage, reviewImage } from "./_utils/draw-checked-image";
import { type ImageAnalytics } from "./_utils/plan-library-image";
import { uploadImageFile } from "./_utils/save-image-asset";

/**
 * `passed`: the picture shown is fine. `replaced`: it failed, and a redrawn picture that passed now
 * shows in its place, wherever it's used. `removed`: the redraws failed too, so lesson screens show
 * their description instead and questions about the picture are no longer asked. `missing`: the
 * asset is gone or has no scene to check against.
 */
export type ImageAssetCheck = { status: "missing" | "passed" | "removed" | "replaced" };

/** Nobody waits on a check of a picture already shown. */
const CHECK_TIER = chooseServiceTier({ wait: "later" });

async function findAsset(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({
    select: { id: true, language: true, ownerId: true, palette: true, scene: true, url: true },
    where: { id: assetId },
  });

  const scene = imageSceneSchema.safeParse(asset?.scene);
  return asset && scene.success ? { ...asset, scene: scene.data } : null;
}

type CheckedAsset = NonNullable<Awaited<ReturnType<typeof findAsset>>>;

/** Lessons showing the picture, so their cached copies are read again. */
async function findLessonTags(assetId: string): Promise<string[]> {
  const steps = await prisma.step.findMany({
    distinct: ["lessonId"],
    select: { lessonId: true },
    where: { mediaAssetId: assetId },
  });

  return steps.map((step) => getLibraryLessonCacheTag(step.lessonId));
}

/**
 * Puts the redrawn picture in the asset's place: every screen and question using it shows it from
 * now on (their rows are touched, so cached lessons, keyed by their screens' last change, are read
 * again), and anyone already looking at the old one keeps it until they open the lesson again.
 */
async function replacePicture({ asset, drawn }: { asset: CheckedAsset; drawn: DrawnImage }) {
  const file = await uploadImageFile({ image: drawn.image, ownerId: asset.ownerId });
  const now = new Date();

  await prisma.$transaction([
    prisma.mediaAsset.update({
      data: { ...file, ...toProvenanceData(drawn.provenance) },
      where: { id: asset.id },
    }),
    prisma.step.updateMany({ data: { updatedAt: now }, where: { mediaAssetId: asset.id } }),
    prisma.item.updateMany({ data: { updatedAt: now }, where: { mediaAssetId: asset.id } }),
  ]);
}

/**
 * Takes a picture no drawing could get right out of use: lesson screens go without it (they show
 * its description), and questions about it are deleted, since a question never goes without the
 * picture it points at. Answers keep their snapshots.
 */
async function removePicture(asset: CheckedAsset) {
  await prisma.$transaction([
    prisma.item.deleteMany({ where: { mediaAssetId: asset.id } }),
    prisma.step.updateMany({ data: { mediaAssetId: null }, where: { mediaAssetId: asset.id } }),
    prisma.mediaAsset.delete({ where: { id: asset.id } }),
  ]);
}

/**
 * The model check of a picture that's already shown (lesson screens and questions get theirs as
 * soon as it's drawn), at the tier of background work. A picture it rejects is drawn again, told
 * what was wrong, and the redraw that passes replaces it in place; when two redraws fail, the
 * picture is taken out of use. Nobody waits on it.
 *
 * This is a workflow bridge: it runs for Library pictures a workflow drew.
 */
export async function checkImageAsset({
  analytics,
  assetId,
}: {
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
    analytics,
    image,
    language,
    scene: asset.scene,
    serviceTier: CHECK_TIER,
  });

  if (review.usable) {
    return { status: "passed" };
  }

  const drawn = await drawCheckedImage({
    analytics,
    corrections: review.problems,
    language,
    palette: getImagePalette(asset.palette),
    scene: asset.scene,
    serviceTier: CHECK_TIER,
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
