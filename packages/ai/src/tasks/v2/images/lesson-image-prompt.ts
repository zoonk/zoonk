import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type ImageScene } from "./image-scene-schema";
import { type ImagePalette } from "./image-style";
import styleBlock from "./image-style.prompt.md";

const LAYOUT_RULES: Record<ImageScene["layout"], string> = {
  comparison:
    "Two small states side by side with a thin vertical divider between them. Only one thing differs between them.",
  sequence:
    "A before and an after (or a cause and its effect) side by side, linked by one thin dashed arrow from left to right.",
  single: "One object in the center.",
};

const CANVAS_RULE =
  "Landscape canvas (3:2). Keep everything in the central area with wide margins, since narrow screens may crop the edges.";

function formatPalette(palette: ImagePalette): string {
  return `Soft colors: ${palette.colors.join(", ")}. Accent: ${palette.accent}.`;
}

function formatScene(scene: ImageScene): string {
  return [
    `- Composition: ${LAYOUT_RULES[scene.layout]}`,
    `- Focal object: ${scene.focalObject}`,
    scene.supportingObjects.length > 0 &&
      `- Supporting objects (small): ${scene.supportingObjects.join("; ")}`,
    scene.relation && `- How they relate: ${scene.relation}`,
    scene.motion && `- Motion (thin dashed lines): ${scene.motion}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Only the scene's labels may appear, spelled exactly as given, because extra
 * or misspelled words are the most common flaw in generated images. Images
 * without labels forbid text outright, so one image serves every language.
 */
function formatText({ language, scene }: { language: string; scene: ImageScene }): string {
  if (scene.labels.length === 0) {
    return "No text anywhere: no letters, words, numbers, captions, signs or symbols that read as text. Don't label any object, not even the ones the scene names.";
  }

  const labels = scene.labels.map((label) => `- "${label.text}" ${label.target}`);
  const count = scene.labels.length;

  return [
    `The image has exactly ${count} ${count === 1 ? "piece" : "pieces"} of text, written in ${getPromptLanguageName({ language })}, each once and spelled exactly as given:`,
    ...labels,
    "Nothing else is written anywhere. Don't label or name any other object, even the ones the scene describes, and add no titles or captions.",
    "A label that goes on an object is written on it, like a price on a tag. Every other label is large, dark gray, in a clean sans-serif, on a small white rounded pill next to what it names, with a thin line pointing at it when needed.",
  ].join("\n");
}

/**
 * A second attempt carries the check's findings, so the model fixes what
 * failed (most often text nobody asked for) instead of repeating it.
 */
function formatCorrections(corrections: readonly string[]): string | null {
  if (corrections.length === 0) {
    return null;
  }

  const problems = corrections.map((problem) => `- ${problem}`);
  return `# Fix\n\nThe last drawing of this scene was rejected for:\n${problems.join("\n")}\nDraw it again without these problems.`;
}

/**
 * The part of an image prompt that changes per image: the scene and its text
 * rules. It is kept apart so a safety retry rewrites only this part and the
 * style never drifts.
 */
export function formatImageSceneInput({
  corrections = [],
  language,
  scene,
}: {
  /** What the check rejected in the previous drawing of this scene. */
  corrections?: readonly string[];
  /** The labels' language. Ignored for scenes without labels. */
  language: string;
  scene: ImageScene;
}): string {
  return [
    `# Scene\n\nWhat to draw. These words describe the picture; they are never written in it.\n${formatScene(scene)}`,
    `# Text\n\n${formatText({ language, scene })}`,
    formatCorrections(corrections),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Builds the image prompt from the fixed, versioned style block and a
 * structured scene. The style block never changes per request, so every image
 * gets the same rules; the palette comes from code, keyed by subject.
 */
export function buildLessonImagePrompt({
  palette,
  sceneInput,
}: {
  palette: ImagePalette;
  /** The scene as `formatImageSceneInput` writes it. */
  sceneInput: string;
}): string {
  return [
    styleBlock.trim(),
    `# Canvas\n\n${CANVAS_RULE}`,
    `# Palette\n\n${formatPalette(palette)}`,
    sceneInput,
  ].join("\n\n");
}

/**
 * Everything every image prompt shares: the style block and the composition
 * rules. Provenance hashes it, so any change to them shows as a new prompt
 * version on the images made after it.
 */
export const LESSON_IMAGE_TEMPLATE = [styleBlock, JSON.stringify(LAYOUT_RULES), CANVAS_RULE].join(
  "\n",
);
