import "server-only";
import { type ImageSceneParams, generateImageScene } from "@zoonk/ai/tasks/images/scene";
import { type ImageScene, describeImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { type ImageCanvas, getImagePalette } from "@zoonk/ai/tasks/images/style";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { resolveLibraryIdentity } from "../../identity/resolve-library-identity";
import { drawImage } from "./draw-checked-image";
import { canStorePicture } from "./picture-store";
import { saveImageAsset } from "./save-image-asset";

export type ImageAnalytics = ImageSceneParams["analytics"];

export type LibraryImageRequest = {
  request: string;
  alt?: string | null;
  canvas?: ImageCanvas;
  screenText?: string | null;
  context?: string | null;
  language: string;
  category: string | null;
  textAllowed: boolean;
  numberedParts?: readonly string[] | null;
  ownerId: string | null;
  analytics?: ImageAnalytics;
};

export type LibraryPicture = { assetId: string; drawn: boolean };

function numberLabels(parts: readonly string[]): ImageScene["labels"] {
  return parts.map((part, index) => ({
    target: `pointing at the ${part}`,
    text: String(index + 1),
  }));
}

/** The caller must dispatch the background image check when the returned picture is newly drawn. */
export async function drawLibraryImage({
  alt,
  analytics,
  canvas,
  category,
  context,
  language,
  numberedParts,
  ownerId,
  request,
  screenText,
  textAllowed,
}: LibraryImageRequest): Promise<LibraryPicture | null> {
  if (!canStorePicture(ownerId)) {
    return null;
  }

  const parts = numberedParts ?? [];

  const { data: planned } = await generateImageScene({
    alt,
    analytics,
    context,
    language,
    request:
      parts.length > 0
        ? `${request}\nShow each of these parts clearly: ${parts.join("; ")}.`
        : request,
    screenText,
    textAllowed: textAllowed && parts.length === 0,
  });

  const scene = parts.length > 0 ? { ...planned, labels: numberLabels(parts) } : planned;
  const prompt = describeImageScene(scene);
  const hasLabels = parts.length === 0 && scene.labels.length > 0;

  const resolution = await resolveLibraryIdentity({
    analytics,
    request: { hasLabels, kind: "image", language, ownerId, prompt, textAllowed },
  });

  if (resolution.kind === "existing") {
    return { assetId: resolution.id, drawn: false };
  }

  const palette = getImagePalette(category);
  const drawn = await drawImage({ analytics, canvas, language, palette, scene });

  if (!drawn) {
    return null;
  }

  const { data: asset, error } = await safeAsync(() =>
    saveImageAsset({
      image: drawn.image,
      language: hasLabels ? language : null,
      ownerId,
      palette: palette.key,
      prompt,
      provenance: drawn.provenance,
      reuseKey: resolution.identityKey,
      scene,
    }),
  );

  if (error) {
    logError("The optional lesson picture could not be saved", error);
    return null;
  }

  return { assetId: asset.id, drawn: true };
}
