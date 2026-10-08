import "server-only";
import { type ImageSceneParams, generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import { type ImageScene, describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { IMAGE_STYLE_VERSION, getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
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
  ownerId,
  request,
  screenText,
  textAllowed,
}: LibraryImageRequest): Promise<PlannedLibraryImage> {
  const { data: scene } = await generateImageScene({
    analytics,
    context,
    language,
    request,
    screenText,
    textAllowed,
  });

  const prompt = describeImageScene(scene);
  const hasLabels = scene.labels.length > 0;

  const resolution = await resolveLibraryIdentity({
    analytics,
    request: {
      hasLabels,
      kind: "image",
      language,
      ownerId,
      prompt,
      styleVersion: IMAGE_STYLE_VERSION,
      textAllowed,
    },
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
