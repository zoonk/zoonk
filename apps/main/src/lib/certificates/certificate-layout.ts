import { SHARE, SHEET, lineBox } from "./certificate-spec";

/*
 * Heights of the sheet's and the post's parts, so the renderer knows before drawing whether they fit
 * and can apply the design's fit rules: what was covered gives way first (the page lists all of it),
 * then the title and the name step down.
 */

const SHEET_CONTENT_HEIGHT = SHEET.height / (SHEET.width / SHEET.units) - SHEET.marginY * 2;

export const TOPIC_COLUMN_WIDTH =
  (SHEET.topics.width - SHEET.topics.columnGap * (SHEET.topics.columns - 1)) / SHEET.topics.columns;

const TOPIC_TEXT_WIDTH = TOPIC_COLUMN_WIDTH - SHEET.topics.check - SHEET.topics.checkGap;

/** Wide scripts take a full em; Geist's Latin averages a little over half of one. */
const WIDE_CHARACTER =
  /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}＀-￯]/u;

const EM_WIDTH = { narrow: 0.56, wide: 1 };

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** A rough line count for text Satori wraps, used only to decide what fits. */
function estimateLines({
  fontSize,
  text,
  width,
}: {
  fontSize: number;
  text: string;
  width: number;
}): number {
  const ems = Array.from(graphemes.segment(text), ({ segment }) => segment).reduce(
    (sum, char) => sum + (WIDE_CHARACTER.test(char) ? EM_WIDTH.wide : EM_WIDTH.narrow),
    0,
  );

  return Math.max(1, Math.ceil((ems * fontSize) / width));
}

export type SheetCovered =
  | { kind: "readouts" }
  | { kind: "topics"; topics: readonly string[] }
  | null;

export type SheetGraphKind = "ladder" | "labelledRoute" | "route";

function getGraphHeight(graph: SheetGraphKind): number {
  if (graph === "ladder") {
    return SHEET.ladder.cellHeight + SHEET.ladder.labelGap + lineBox(SHEET.ladder.labelSize);
  }

  const labels = graph === "labelledRoute" ? SHEET.route.labelHeight + SHEET.route.labelGap : 0;

  return labels + SHEET.route.height;
}

function getTopicRowLines(topics: readonly string[]): number[] {
  const { columns, size } = SHEET.topics;

  const lines = topics.map((topic) =>
    estimateLines({ fontSize: size, text: topic, width: TOPIC_TEXT_WIDTH }),
  );

  return Array.from({ length: Math.ceil(lines.length / columns) }, (_row, row) =>
    Math.max(...lines.slice(row * columns, (row + 1) * columns)),
  );
}

function getCoveredHeight(covered: SheetCovered): number {
  const label = lineBox(SHEET.covered.labelSize);

  if (!covered) {
    return 0;
  }

  if (covered.kind === "readouts") {
    return SHEET.covered.above + label + SHEET.covered.labelGap + SHEET.covered.readoutSize;
  }

  const rows = getTopicRowLines(covered.topics);
  const lines = rows.reduce((sum, rowLines) => sum + rowLines, 0);
  const topicLine = lineBox(SHEET.topics.size, SHEET.topics.lineHeight);
  const list = lines * topicLine + SHEET.covered.rowGap * (rows.length - 1);

  return SHEET.covered.above + label + SHEET.covered.listGap + list;
}

function getFooterHeight(finePrint: string): number {
  const { footer } = SHEET;

  const finePrintLines = estimateLines({
    fontSize: footer.finePrintSize,
    text: finePrint,
    width: footer.finePrintWidth,
  });

  const facts = lineBox(footer.labelSize) + footer.factLabelGap + lineBox(footer.valueSize);

  const finePrintHeight =
    finePrintLines * lineBox(footer.finePrintSize, footer.finePrintLineHeight);

  return Math.max(footer.qr, facts + footer.finePrintGap + finePrintHeight);
}

/** How far the sheet's parts run past its content box, in u; zero or less fits. */
export function getSheetOverflow({
  covered,
  finePrint,
  graph,
  nameHeight,
  titleHeight,
}: {
  covered: SheetCovered;
  finePrint: string;
  graph: SheetGraphKind;
  nameHeight: number;
  titleHeight: number;
}): number {
  const height = [
    lineBox(SHEET.brand.size),
    SHEET.kind.above + lineBox(SHEET.kind.size, SHEET.kind.lineHeight),
    SHEET.name.above + nameHeight,
    SHEET.title.above + titleHeight,
    SHEET.meta.above + SHEET.meta.chipHeight,
    getCoveredHeight(covered),
    SHEET.graph.above + getGraphHeight(graph),
    SHEET.footer.above + SHEET.footer.rule + SHEET.footer.ruleGap + getFooterHeight(finePrint),
  ].reduce((sum, part) => sum + part, 0);

  return height - SHEET_CONTENT_HEIGHT;
}

/** The covered block's fallbacks, in the order the design gives way: all six, the first two, none. */
export function getCoveredFallbacks(covered: SheetCovered): SheetCovered[] {
  if (covered?.kind !== "topics") {
    return [covered, null];
  }

  return [
    covered,
    { kind: "topics", topics: covered.topics.slice(0, SHEET.topics.shownAfterOverflow) },
    null,
  ];
}

const { link, post } = SHARE;

const LINK_CONTENT_HEIGHT = link.height - link.inset * 2 - link.padding.top - link.padding.bottom;

/** How far the link picture's parts run past its sheet, in px; zero or less fits. */
export function getLinkOverflow({
  graph,
  nameHeight,
  titleHeight,
}: {
  graph: "ladder" | "route";
  nameHeight: number;
  titleHeight: number;
}): number {
  const graphHeight =
    graph === "ladder"
      ? link.ladder.cellHeight + link.ladder.labelGap + lineBox(link.ladder.labelSize)
      : link.route.height;

  const height = [
    Math.max(link.brand.logo, lineBox(link.brand.size), lineBox(link.kind.size)),
    nameHeight,
    link.title.above + titleHeight,
    link.graph.above + graphHeight,
    link.bottom.above + lineBox(link.bottom.size),
  ].reduce((sum, part) => sum + part, 0);

  return height - LINK_CONTENT_HEIGHT;
}

const POST_CONTENT_HEIGHT = post.height - post.inset * 2 - post.padding.top - post.padding.bottom;

function getPostGraphHeight(graph: "ladder" | "route"): number {
  if (graph === "ladder") {
    return post.ladder.cellHeight + post.ladder.labelGap + lineBox(post.ladder.labelSize);
  }

  return post.route.labelHeight + post.route.labelGap + post.route.height;
}

/** How far the post's parts run past its sheet, in px; zero or less fits. */
export function getPostOverflow({
  graph,
  hasStats,
  nameHeight,
  titleHeight,
}: {
  graph: "ladder" | "route";
  hasStats: boolean;
  nameHeight: number;
  titleHeight: number;
}): number {
  const stats =
    post.stats.above + post.stats.size + post.stats.labelGap + lineBox(post.stats.labelSize);

  const bottom =
    post.bottom.above + post.bottom.rule + post.bottom.ruleGap + lineBox(post.bottom.size);

  const height = [
    lineBox(post.brand.size),
    lineBox(post.kind.size),
    post.name.above + nameHeight,
    post.title.above + titleHeight,
    post.graph.above + getPostGraphHeight(graph),
    hasStats ? stats : 0,
    bottom,
  ].reduce((sum, part) => sum + part, 0);

  return height - POST_CONTENT_HEIGHT;
}
