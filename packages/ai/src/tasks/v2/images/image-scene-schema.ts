import { z } from "zod";

/**
 * Short labels: a word, a number or a price, large enough to read on a phone.
 * Numbers and prices don't count as words, so "you pay $60" is two. Six lets a
 * whole show the parts its screen names (the brain's four lobes, a cycle's
 * stages, a map's places) while every label stays legible.
 */
const IMAGE_SCENE_LIMITS = { maxLabelWords: 4, maxLabels: 6, maxSupportingObjects: 2 } as const;

const IMAGE_SCENE_LAYOUTS = ["single", "comparison", "sequence"] as const;

const imageLabelSchema = z.object({
  /** Where the label goes, in English: "next to the nucleus", or "on the old price tag" for an object's own text. */
  target: z.string(),
  /** The label exactly as it appears in the image, in the lesson's language. */
  text: z.string(),
});

/**
 * A scene is fields, not prose, so every image follows the same composition
 * rules and two requests for the same picture describe it the same way.
 * Everything but the labels is in English: image models follow English best,
 * and an image without text is then one scene for every language.
 */
export const imageSceneSchema = z.object({
  focalObject: z.string(),
  labels: z.array(imageLabelSchema),
  /** One object, two states side by side, or a before and after (cause and effect). */
  layout: z.enum(IMAGE_SCENE_LAYOUTS),
  motion: z.string().nullable(),
  relation: z.string().nullable(),
  supportingObjects: z.array(z.string()),
});

export type ImageScene = z.infer<typeof imageSceneSchema>;
type ImageLabel = z.infer<typeof imageLabelSchema>;

const LETTER_PATTERN = /\p{L}/u;

function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => LETTER_PATTERN.test(token)).length;
}

/** Scene fields are joined into sentences, so their own trailing periods are dropped. */
function cleanText(value: string): string {
  return value.trim().replace(/[.\s]+$/u, "");
}

function toOptionalText(value: string | null): string | null {
  return cleanText(value ?? "") || null;
}

function isShortLabel(label: ImageLabel): boolean {
  return label.text.length > 0 && countWords(label.text) <= IMAGE_SCENE_LIMITS.maxLabelWords;
}

/**
 * Enforces the style rules a model may bend: at most two supporting objects,
 * at most six labels of up to four words and no text where text isn't allowed
 * (language courses). A label that is too long is dropped rather than drawn,
 * since long text in an image is where spelling errors come from.
 */
export function normalizeImageScene({
  scene,
  textAllowed,
}: {
  scene: ImageScene;
  textAllowed: boolean;
}): ImageScene {
  const labels = scene.labels
    .map((label) => ({ target: label.target.trim(), text: label.text.trim() }))
    .filter((label) => isShortLabel(label))
    .slice(0, IMAGE_SCENE_LIMITS.maxLabels);

  return {
    focalObject: cleanText(scene.focalObject),
    labels: textAllowed ? labels : [],
    layout: scene.layout,
    motion: toOptionalText(scene.motion),
    relation: toOptionalText(scene.relation),
    supportingObjects: scene.supportingObjects
      .map((item) => cleanText(item))
      .filter(Boolean)
      .slice(0, IMAGE_SCENE_LIMITS.maxSupportingObjects),
  };
}

/**
 * The scene as one line of text: what an image asset stores as its prompt,
 * what identity search matches and what the reuse decision reads. The same
 * fields always give the same text, so the same scene gets the same key.
 */
export function describeImageScene(scene: ImageScene): string {
  const labels = scene.labels.map((label) => `"${label.text}" ${label.target}`);

  return [
    `Layout: ${scene.layout}.`,
    `Focal object: ${scene.focalObject}.`,
    scene.supportingObjects.length > 0 &&
      `Supporting objects: ${scene.supportingObjects.join("; ")}.`,
    scene.relation && `Relation: ${scene.relation}.`,
    scene.motion && `Motion: ${scene.motion}.`,
    labels.length > 0 ? `Labels: ${labels.join("; ")}.` : "No text.",
  ]
    .filter(Boolean)
    .join(" ");
}
