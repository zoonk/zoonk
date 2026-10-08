import { type MindMapStructure, getMindMapHeadings } from "./mind-map-schema";

/**
 * The version of the mind-map style and prompt layout. Every map stores it, so a change that makes
 * new maps look different bumps it. Version 2 moved from warm paper to a plain white background.
 */
export const MIND_MAP_STYLE_VERSION = 2;

/** One color per branch, in order, the same on every map. */
const BRANCH_COLORS = ["purple", "orange", "blue", "green", "golden yellow", "pink"] as const;

/**
 * The fixed look of every map: a neat colored-marker study sheet on a clean white background. Kept
 * apart from a map's content so its art direction never drifts between maps.
 */
export const MIND_MAP_IMAGE_TEMPLATE = `A hand-drawn mind map filling the whole square image edge to edge on a plain pure white background (#FFFFFF: no paper texture, tint, shadow, desk, frame or border), like a neat student's colored-marker study sheet. Friendly sketch style: dark navy hand-lettered text that is crisp, large and easy to read, soft colors, small colored-pencil sketches, plenty of white space between parts. No photo, no 3D, no clutter.

{{CONTENT}}

TEXT RULES: the sketches have no letters, words or numbers on them. Letter every quoted text exactly as written above, word by word, with every accent and punctuation mark. Add no other words, titles, captions, numbers, labels or signatures anywhere. Every word must be fully legible.`;

function quoteList(points: readonly string[]): string {
  return points.map((point) => `"• ${point}"`).join(" ");
}

function describeBranch(branch: MindMapStructure["branches"][number], index: number): string {
  return [
    `${index + 1}. Label (${BRANCH_COLORS[index] ?? "teal"}): "${index + 1}. ${branch.title}"`,
    `   Sentence: "${branch.explanation}"`,
    `   Bullets: ${quoteList(branch.points)}`,
    `   Small sketch beside it (draw it, never write these words): ${branch.drawing}`,
  ].join("\n");
}

function describeComparison(comparison: MindMapStructure["comparison"]): string {
  if (!comparison) {
    return "";
  }

  const columns = comparison.columns
    .map((column) => `- "${column.name}": ${quoteList(column.points)}`)
    .join("\n");

  return `\nBELOW THE BRANCHES: a wide rounded table with the heading "${comparison.title}" on a dark navy tab, ${comparison.columns.length} columns split by dashed lines. Each column has its name as a colored heading and its bullets:\n${columns}\n`;
}

/**
 * A map's own part of the picture prompt: where each text goes and the exact words to letter,
 * plus what the text check found in the last picture, so a second one fixes it.
 */
export function formatMindMapImageContent({
  corrections = [],
  language,
  structure,
}: {
  corrections?: readonly string[];
  language: string;
  structure: MindMapStructure;
}): string {
  const headings = getMindMapHeadings(language);
  const branches = structure.branches.map((branch, index) => describeBranch(branch, index));

  const fixes =
    corrections.length > 0
      ? `\nTHE LAST DRAWING HAD THESE MISTAKES, DON'T REPEAT THEM: ${corrections.join("; ")}\n`
      : "";

  return `CENTER: a cloud-shaped bubble outlined in dark navy with the title in big bold capitals: "${structure.title}".

TOP CENTER: a small green rounded label "${headings.centralIdea}" and under it, in small print: "${structure.centralIdea}"

AROUND THE CENTER: ${structure.branches.length} numbered branches spread evenly, each a rounded label box outlined in its own color and joined to the center cloud by a curved line of that color. Under each label: its sentence in small print, then a dashed rounded box in the same color with its bullets.
${branches.join("\n")}
${describeComparison(structure.comparison)}
BOTTOM: a long rounded box with a small lightbulb sketch on its left and the text "${headings.summary}: ${structure.summary}"
${fixes}`;
}

export function buildMindMapImagePrompt(content: string): string {
  return MIND_MAP_IMAGE_TEMPLATE.replace("{{CONTENT}}", () => content);
}
