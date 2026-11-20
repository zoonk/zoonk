import "server-only";
import { createHash } from "node:crypto";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { type ImageScene, describeImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { getImagePalette } from "@zoonk/ai/tasks/images/style";
import { readStoredImage } from "../../../images/read-stored-image";
import { drawImage, reviewImage } from "../../../library/media/_utils/draw-image";
import { planLibraryImageScene } from "../../../library/media/_utils/draw-library-image";
import {
  saveCheckedImageAsset,
  uploadImageFile,
} from "../../../library/media/_utils/save-image-asset";
import { type ContentFixMediaNeed } from "../media-schema";

type PictureNeed = Extract<ContentFixMediaNeed, { kind: "picture" }>;

export function planFixPicture(need: PictureNeed): Promise<ImageScene> {
  return planLibraryImageScene({
    alt: need.alt,
    context: need.context,
    language: need.language,
    numberedParts: need.numberedParts,
    request: need.request,
    textAllowed: false,
  });
}

export async function drawFixPicture({ need, scene }: { need: PictureNeed; scene: ImageScene }) {
  const palette = getImagePalette(need.category);

  const drawn = await drawImage({
    attempts: 1,
    canvas: "landscape",
    language: need.language,
    palette,
    scene,
  });

  if (!drawn) {
    throw new Error("The proposed picture was a blank frame.");
  }

  return {
    file: await uploadImageFile({ image: drawn.image, ownerId: null }),
    palette: palette.key,
    provenance: drawn.provenance,
  };
}

export async function checkFixPicture({
  drawn,
  need,
  scene,
}: {
  drawn: Awaited<ReturnType<typeof drawFixPicture>>;
  need: PictureNeed;
  scene: ImageScene;
}): Promise<boolean> {
  const review = await reviewImage({
    alt: need.alt ?? need.request,
    image: await readStoredImage({ url: drawn.file.url }),
    language: need.language,
    scene,
    serviceTier: chooseServiceTier({ wait: "later" }),
  });

  return review.usable;
}

export async function storeFixPicture({
  drawn,
  fixId,
  need,
  scene,
}: {
  drawn: Awaited<ReturnType<typeof drawFixPicture>>;
  fixId: string;
  need: PictureNeed;
  scene: ImageScene;
}) {
  const key = createHash("sha256").update(need.key).digest("hex");

  const { row } = await saveCheckedImageAsset({
    ...drawn,
    alt: need.alt ?? need.request,
    language: null,
    ownerId: null,
    prompt: describeImageScene(scene),
    reuseKey: `image:fix:${fixId}:${key}`,
    scene,
  });

  return { key: need.key, kind: "picture" as const, mediaAssetId: row.id, url: row.url };
}
