import {
  type ChartVisual,
  type LessonVisual,
  type PlotVisual,
} from "@zoonk/ai/tasks/visuals/schema";
import { findMarkdownTables, findRaggedTableRows } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";
import { VISUAL_KINDS, type VisualKind, getVisualPatterns } from "./visual-reference-patterns";

function normalizeForPhrases(text: string): string {
  return ` ${normalizeString(text.replaceAll("’", "'")).replaceAll(/[^\p{L}\p{N}]+/gu, " ")} `;
}

function findVisualReferences({
  language,
  text,
}: {
  language: string;
  text: string;
}): Set<VisualKind> {
  const normalized = normalizeForPhrases(text);
  const patterns = getVisualPatterns(language);

  const kinds = VISUAL_KINDS.filter((kind) =>
    patterns[kind].some((pattern) => pattern.test(normalized)),
  );

  return new Set(kinds);
}

const NUMBERED_PANELS =
  /(?<!\p{L})(?<panel>\p{L}+) 1(?!\d)(?:.*(?<!\p{L})\k<panel> 2(?!\d)| \p{L}{1,3} 2(?!\d))/isu;

export function pointsAtFigure({
  kind,
  language,
  text,
}: {
  kind?: "chart";
  language: string;
  text: string;
}): boolean {
  if (kind === "chart") {
    const normalized = normalizeForPhrases(text);

    return getVisualPatterns(language).chart.some((pattern) => pattern.test(normalized));
  }

  const kinds = findVisualReferences({ language, text });

  return (
    kinds.has("image") ||
    kinds.has("panels") ||
    kinds.has("chart") ||
    kinds.has("timeline") ||
    NUMBERED_PANELS.test(text)
  );
}

export type ShownVisuals = {
  explores?: boolean;
  hasImage: boolean;
  texts: readonly string[];
  visual: LessonVisual | null;
};

const SHOWS: Readonly<Record<VisualKind, (shown: ShownVisuals) => boolean>> = {
  chart: ({ explores, hasImage, visual }) =>
    hasImage || explores === true || visual?.kind === "chart" || visual?.kind === "plot",
  image: (shown) => shown.hasImage || shown.explores === true,
  panels: (shown) => shown.hasImage,
  table: (shown) =>
    shown.hasImage || shown.texts.some((text) => findMarkdownTables(text).length > 0),
  timeline: (shown) =>
    shown.hasImage || shown.explores === true || shown.visual?.kind === "timeline",
};

const MISSING: Readonly<Record<VisualKind, string>> = {
  chart:
    "Its words point at a chart, but it shows none: give it a `visual` of kind chart or plot with the data, or an `image` of it when the app can't draw it (a pie chart).",
  image:
    "Its words point at a picture (a scene, a diagram, a map or an illustration), but it shows none: give it an `image` whose `prompt` describes that picture with every label and detail the words use.",
  panels:
    "Its words name numbered drawings or charts (Desenho 1, Gráfico 2) it doesn't show: put two side by side in one `image` labeled 1 and 2 (never more than two), or show one chart as a `visual` and ask about it without numbering charts.",
  table:
    "Its words point at a table, but it shows none: write the table in Markdown in its text (a header row, a `---` row, one row per line), or don't refer to a table.",
  timeline:
    "Its words point at a timeline, but it shows none: give it a `visual` of kind timeline with the dated events, or don't refer to a timeline.",
};

const DRAWING_CHARACTERS = /[█▇▆▅▄▃▂▁▌▐■●○◆╱╲]/u;

const ASCII_AXES =
  /\+[ \t]*[-=_]{3,}|\|[ \t]*(?:[.*+][ \t]*){2,}|^[ \t]*(?:\w[ \t]*)?\|[ \t]*[*+]/mu;

const ASCII_BARS = /:[ \t]*(?:#{3,}|={3,})(?=\s|$)|[*+][-=_]{3,}[*+]/u;

export function drawsWithCharacters(text: string): boolean {
  return DRAWING_CHARACTERS.test(text) || ASCII_AXES.test(text) || ASCII_BARS.test(text);
}

function hasRepeatedNames(names: readonly string[]): boolean {
  return new Set(names.map((name) => normalizeString(name))).size !== names.length;
}

function getCategoryChartProblems(visual: ChartVisual): string[] {
  const count = visual.categories.length;
  const uneven = visual.series.filter((series) => series.values.length !== count);
  const categories = visual.categories.map((category) => normalizeString(category));

  const lowest = Math.min(...visual.series.flatMap((series) => series.values));

  return [
    ...(visual.axisStart !== null && visual.axisStart > lowest
      ? [`The chart's axis starts at ${visual.axisStart}, above its lowest value (${lowest}).`]
      : []),
    ...uneven.map(
      (series) =>
        `The chart's series "${series.name}" has ${series.values.length} values for ${count} categories: give one value per category, in order.`,
    ),
    ...(new Set(categories).size === categories.length
      ? []
      : ["Two of the chart's categories are the same: each category labels one bar or point."]),
    ...((visual.axisStart !== null && !Number.isFinite(visual.axisStart)) ||
    visual.series.some((series) => series.values.some((value) => !Number.isFinite(value)))
      ? ["The chart has a value that isn't a number."]
      : []),
  ];
}

function getPlotProblems(visual: PlotVisual): string[] {
  const labels = visual.series.flatMap((series) =>
    series.points.flatMap((point) => (point.label === null ? [] : [point.label])),
  );

  return [
    ...visual.series.flatMap(({ mark, name, points }) => [
      points.length === 0 && `Plot series "${name}" has no points.`,
      points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y)) &&
        `Plot series "${name}" has a point without finite x and y values.`,
      mark !== "points" && points.length < 2 && `Plot line "${name}" needs at least two points.`,
      mark !== "points" &&
        points.slice(1).some(({ x }, index) => x <= (points[index]?.x ?? x)) &&
        `Plot line "${name}" needs points in strictly increasing x order.`,
    ]),
    visual.references.some(({ y }) => !Number.isFinite(y)) &&
      "The plot has a reference without a finite y value.",
    hasRepeatedNames(labels) && "Plot point labels must be unique.",
  ].filter((problem) => typeof problem === "string");
}

export function getChartProblems(visual: LessonVisual): string[] {
  if (visual.kind === "timeline") {
    return [];
  }

  const problems = [
    visual.series.length === 0 && "The chart needs at least one series.",
    hasRepeatedNames(visual.series.map(({ name }) => name)) && "Chart series names must be unique.",
  ].filter((problem) => typeof problem === "string");

  return [
    ...problems,
    ...(visual.kind === "plot" ? getPlotProblems(visual) : getCategoryChartProblems(visual)),
  ];
}

export function getVisualProblems({
  canShowImage = true,
  language,
  shown,
}: {
  canShowImage?: boolean;
  language: string;
  shown: ShownVisuals;
}): string[] {
  const referenced = findVisualReferences({ language, text: shown.texts.join("\n") });
  const ragged = shown.texts.flatMap((text) => findRaggedTableRows(text));

  return [
    ...[...referenced]
      .filter((kind) => !SHOWS[kind](shown))
      .map((kind) =>
        (kind === "image" || kind === "panels") && !canShowImage
          ? "Its words point at a picture, but questions here can't show one: ask about something the learner reads (a text, a table, a chart or a timeline) instead of a picture."
          : MISSING[kind],
      ),
    ...ragged.map(
      (row) =>
        `This table row doesn't have one cell per column of its header: "${row.trim()}". Give every row the header's cells.`,
    ),
    ...(shown.visual ? getChartProblems(shown.visual) : []),
    ...(shown.hasImage && shown.visual
      ? ["It has both a picture and a chart or timeline: show one of them."]
      : []),
    ...(shown.explores === true && (shown.hasImage || shown.visual)
      ? ["It shows a template to explore and a picture, chart or timeline too: show one of them."]
      : []),
    ...(shown.texts.some((text) => drawsWithCharacters(text))
      ? [
          "It draws a chart or diagram with characters (bars, points or an axis made of symbols): show the data as a Markdown table or a `visual`, or ask for a picture, and keep the words plain.",
        ]
      : []),
  ];
}
