import "server-only";
import { type ImageSceneParams, generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import { type ImageScene, describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
import { resolveLibraryIdentity } from "../../identity/resolve-library-identity";

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

/**
 * What to draw when no existing image fits. It is plain data, so a workflow
 * can plan in one step and draw in another.
 */
export type ImagePlan = {
  reuseKey: string;
  scene: ImageScene;
  /** The scene as one line, stored as the asset's prompt. */
  prompt: string;
  palette: string;
  language: string;
  /** The labels' language, or null for an image without text. */
  labelLanguage: string | null;
  ownerId: string | null;
};

export type PlannedLibraryImage =
  | { kind: "existing"; assetId: string }
  | { kind: "generate"; plan: ImagePlan };

/** One number on each part, in order: "1" on the first. */
function numberLabels(parts: readonly string[]): ImageScene["labels"] {
  return parts.map((part, index) => ({
    target: `pointing at the ${part}`,
    text: String(index + 1),
  }));
}

/**
 * Plans one Library image: a structured scene first, then the same agentic
 * identity flow as lessons (exact key, model search terms, text search and a
 * "same scene?" decision), so each scene is drawn once and reused.
 */
export async function planLibraryImage({
  analytics,
  category,
  context,
  language,
  numberedParts,
  ownerId,
  request,
  screenText,
  textAllowed,
}: LibraryImageRequest): Promise<PlannedLibraryImage> {
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
    return { assetId: resolution.id, kind: "existing" };
  }

  return {
    kind: "generate",
    plan: {
      labelLanguage: hasLabels ? language : null,
      language,
      ownerId,
      palette: getImagePalette(category).key,
      prompt,
      reuseKey: resolution.identityKey,
      scene,
    },
  };
}
