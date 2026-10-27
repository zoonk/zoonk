import "server-only";
import { type ImageSceneParams, generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import { type ImageScene, describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
import { resolveLibraryIdentity } from "../../identity/resolve-library-identity";
import { drawImage } from "./draw-checked-image";
import { canStorePicture } from "./picture-store";
import { saveImageAsset } from "./save-image-asset";

export type ImageAnalytics = ImageSceneParams["analytics"];

export type LibraryImageRequest = {
  /** What the writer wants the picture to show. */
  request: string;
  screenText?: string | null;
  /** Where it sits: the course, chapter and lesson titles. */
  context?: string | null;
  /** The content language, for labels. */
  language: string;
  /** The course category that picks the palette. */
  category: string | null;
  /** False for language courses: their images carry no text. */
  textAllowed: boolean;
  /**
   * The parts a numbered picture marks, in order: code writes the numbers as its only labels
   * (1 on the first part), so the screen's answer key is this list. Numbers carry no language.
   */
  numberedParts?: readonly string[] | null;
  /** The owner of a private course; its images stay private and are never reused. */
  ownerId: string | null;
  analytics?: ImageAnalytics;
};

/** A Library picture: the asset, and whether it was drawn now (its model check is still to run). */
export type LibraryPicture = { assetId: string; drawn: boolean };

/** One number on each part, in order: "1" on the first. */
function numberLabels(parts: readonly string[]): ImageScene["labels"] {
  return parts.map((part, index) => ({
    target: `pointing at the ${part}`,
    text: String(index + 1),
  }));
}

/**
 * One Library picture: a structured scene first, then the same agentic identity flow as lessons
 * (exact key, model search terms, text search and a "same scene?" decision), so each scene is
 * drawn once and reused. A new image is saved to show at once: only the code check runs here, and
 * the caller starts its model check in the background (`checkImageAsset`), which replaces a
 * picture it rejects. Null when the picture can't be stored (`canStorePicture`) or every drawing
 * came out blank.
 */
export async function drawLibraryImage({
  analytics,
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
  // Numbers read the same in every language, so a numbered picture serves them all.
  const hasLabels = parts.length === 0 && scene.labels.length > 0;

  const resolution = await resolveLibraryIdentity({
    analytics,
    request: { hasLabels, kind: "image", language, ownerId, prompt, textAllowed },
  });

  if (resolution.kind === "existing") {
    return { assetId: resolution.id, drawn: false };
  }

  const palette = getImagePalette(category);
  const drawn = await drawImage({ analytics, language, palette, scene });

  if (!drawn) {
    return null;
  }

  const asset = await saveImageAsset({
    image: drawn.image,
    language: hasLabels ? language : null,
    ownerId,
    palette: palette.key,
    prompt,
    provenance: drawn.provenance,
    reuseKey: resolution.identityKey,
    scene,
  });

  return { assetId: asset.id, drawn: true };
}
