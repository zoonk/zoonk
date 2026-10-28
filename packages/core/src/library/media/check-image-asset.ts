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
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { type DrawnImage, drawCheckedImage, reviewImage } from "./_utils/draw-checked-image";
import { type ImageAnalytics } from "./_utils/draw-library-image";
import { uploadImageFile } from "./_utils/save-image-asset";

export type ImageAssetCheck = { status: "missing" | "passed" | "removed" | "replaced" };

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

async function replacePicture({ asset, drawn }: { asset: CheckedAsset; drawn: DrawnImage }) {
  const file = await uploadImageFile({ image: drawn.image, ownerId: asset.ownerId });
  const now = new Date();

  await prisma.$transaction([
    prisma.mediaAsset.update({
      data: { ...file, ...toProvenanceData(drawn.provenance) },
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

/** Internal workflow bridge for pictures drawn by an existing generation workflow. */
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
