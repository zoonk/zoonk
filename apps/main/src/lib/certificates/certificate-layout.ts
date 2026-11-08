import { SHARE, SHEET, lineBox } from "./certificate-spec";

/*
 * Heights of the sheet's and the post's parts, so the renderer knows before drawing whether they fit
 * and can apply the design's fit rules: what was covered gives way first (the page lists all of it),
 * then the title and the name step down.
 */

const SHEET_CONTENT_HEIGHT = SHEET.height / (SHEET.width / SHEET.units) - SHEET.marginY * 2;

const SHEET_CONTENT_WIDTH = SHEET.units - SHEET.marginX * 2;

export const TOPIC_COLUMN_WIDTH =
  (SHEET.topics.width - SHEET.topics.columnGap * (SHEET.topics.columns - 1)) / SHEET.topics.columns;

const TOPIC_TEXT_WIDTH = TOPIC_COLUMN_WIDTH - SHEET.topics.check - SHEET.topics.checkGap;

/** Wide scripts take a full em; Geist's Latin averages a little over half of one, Geist Mono's 0.6. */
const WIDE_CHARACTER =
  /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}＀-￯]/u;

const EM_WIDTH = { mono: 0.6, narrow: 0.56, wide: 1 };

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function countEms({ narrow, text }: { narrow: number; text: string }): number {
  return Array.from(graphemes.segment(text), ({ segment }) => segment).reduce(
    (sum, char) => sum + (WIDE_CHARACTER.test(char) ? EM_WIDTH.wide : narrow),
    0,
  );
}

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
  const ems = countEms({ narrow: EM_WIDTH.narrow, text });
  return Math.max(1, Math.ceil((ems * fontSize) / width));
}

export type SheetCovered = { topics: readonly string[] } | null;

type RouteSpec = { height: number; labelGap: number; labelHeight: number };

function getGraphHeight({ labelled, route }: { labelled: boolean; route: RouteSpec }): number {
  const labels = labelled ? route.labelHeight + route.labelGap : 0;
  return labels + route.height;
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

  const rows = getTopicRowLines(covered.topics);
  const lines = rows.reduce((sum, rowLines) => sum + rowLines, 0);
  const topicLine = lineBox(SHEET.topics.size, SHEET.topics.lineHeight);
  const list = lines * topicLine + SHEET.covered.rowGap * (rows.length - 1);

  return SHEET.covered.above + label + SHEET.covered.listGap + list;
}

type Fact = { label: string; value: string };

/** What the verify block and the QR code leave the facts and the fine print, in u. */
function getFactsColumnWidth({
  displayUrl,
  verifyLabel,
}: {
  displayUrl: string;
  verifyLabel: string;
}): number {
  const { footer } = SHEET;

  const verifyWidth = Math.max(
    countEms({ narrow: EM_WIDTH.narrow, text: verifyLabel }) * footer.labelSize,
    countEms({ narrow: EM_WIDTH.mono, text: displayUrl }) * footer.verifySize,
  );

  return SHEET_CONTENT_WIDTH - verifyWidth - footer.qr - footer.columnGap * 2;
}

function getFactWidth(fact: Fact): number {
  const { footer } = SHEET;

  return Math.max(
    countEms({ narrow: EM_WIDTH.narrow, text: fact.label }) * footer.labelSize,
    countEms({ narrow: EM_WIDTH.mono, text: fact.value }) * footer.valueSize,
  );
}

export type FactsFit = { column: number; gap: number; scale: number };

/** Facts wider than their column close their gaps to the footer's column gap, then shrink. */
export function getFactsFit({
  displayUrl,
  facts,
  verifyLabel,
}: {
  displayUrl: string;
  facts: readonly Fact[];
  verifyLabel: string;
}): FactsFit {
  const { columnGap, factGap } = SHEET.footer;
  const column = getFactsColumnWidth({ displayUrl, verifyLabel });
  const gaps = facts.length - 1;
  const textWidth = facts.reduce((sum, fact) => sum + getFactWidth(fact), 0);
  const spare = (column - textWidth) / Math.max(gaps, 1);
  const gap = Math.min(factGap, Math.max(columnGap, spare));

  return { column, gap, scale: Math.min(1, (column - gap * gaps) / textWidth) };
}

function getFooterHeight({ facts, finePrint }: { facts: FactsFit; finePrint: string }): number {
  const { footer } = SHEET;

  const finePrintLines = estimateLines({
    fontSize: footer.finePrintSize,
    text: finePrint,
    width: Math.min(footer.finePrintWidth, facts.column),
  });

  const factsHeight = lineBox(footer.labelSize) + footer.factLabelGap + lineBox(footer.valueSize);

  const finePrintHeight =
    finePrintLines * lineBox(footer.finePrintSize, footer.finePrintLineHeight);

  return Math.max(footer.qr, factsHeight + footer.finePrintGap + finePrintHeight);
}

/** How far the sheet's parts run past its content box, in u; zero or less fits. */
export function getSheetOverflow({
  covered,
  facts,
  finePrint,
  labelledGraph,
  nameHeight,
  titleHeight,
}: {
  covered: SheetCovered;
  facts: FactsFit;
  finePrint: string;
  labelledGraph: boolean;
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
    SHEET.graph.above + getGraphHeight({ labelled: labelledGraph, route: SHEET.route }),
    SHEET.footer.above +
      SHEET.footer.rule +
      SHEET.footer.ruleGap +
      getFooterHeight({ facts, finePrint }),
  ].reduce((sum, part) => sum + part, 0);

  return height - SHEET_CONTENT_HEIGHT;
}

/** The covered block's fallbacks, in the order the design gives way: all six, the first two, none. */
export function getCoveredFallbacks(covered: SheetCovered): SheetCovered[] {
  if (!covered) {
    return [null];
  }

  return [covered, { topics: covered.topics.slice(0, SHEET.topics.shownAfterOverflow) }, null];
}

const { link, post } = SHARE;

const LINK_CONTENT_HEIGHT = link.height - link.inset * 2 - link.padding.top - link.padding.bottom;

/** How far the link picture's parts run past its sheet, in px; zero or less fits. */
export function getLinkOverflow({
  labelledGraph,
  nameHeight,
  titleHeight,
}: {
  labelledGraph: boolean;
  nameHeight: number;
  titleHeight: number;
}): number {
  const height = [
    Math.max(link.brand.logo, lineBox(link.brand.size), lineBox(link.kind.size)),
    nameHeight,
    link.title.above + titleHeight,
    link.graph.above + getGraphHeight({ labelled: labelledGraph, route: link.route }),
    link.bottom.above + lineBox(link.bottom.size),
  ].reduce((sum, part) => sum + part, 0);

  return height - LINK_CONTENT_HEIGHT;
}

const POST_CONTENT_HEIGHT = post.height - post.inset * 2 - post.padding.top - post.padding.bottom;

const POST_GRAPH_HEIGHT = getGraphHeight({ labelled: true, route: post.route });

/** How far the post's parts run past its sheet, in px; zero or less fits. */
export function getPostOverflow({
  hasStats,
  nameHeight,
  titleHeight,
}: {
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
    post.graph.above + POST_GRAPH_HEIGHT,
    hasStats ? stats : 0,
    bottom,
  ].reduce((sum, part) => sum + part, 0);

  return height - POST_CONTENT_HEIGHT;
}
