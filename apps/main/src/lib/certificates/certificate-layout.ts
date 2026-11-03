/*
 * Heights of the sheet's and the post's parts, so the renderer knows before drawing whether they fit
 * and can apply the design's fit rules: what was covered gives way first (the page lists all of it),
 * then the title and the name step down. The sheet is in the design's units (1 u = 1/1123 of its
 * width), the post in pixels.
 */

const BODY_LINE_HEIGHT = 1.43;

function lineBox(fontSize: number, lineHeight = BODY_LINE_HEIGHT): number {
  return fontSize * lineHeight;
}

export const SHEET = {
  height: 2480,
  marginY: 49,
  units: 1123,
  width: 3508,
} as const;

const SHEET_CONTENT_HEIGHT = SHEET.height / (SHEET.width / SHEET.units) - SHEET.marginY * 2;

/** The sheet's parts that are always there, as the space above each and its height. */
const SHEET_PARTS = [
  { above: 0, height: lineBox(22) },
  { above: 84, height: lineBox(20, 1.2) },
  { above: 16, height: 0 },
  { above: 26, height: 0 },
  { above: 16, height: 24 },
  { above: 26, height: 0 },
  { above: 30, height: 1 },
  { above: 22, height: 0 },
];

const SHEET_GRAPHS = {
  labelledRoute: 18 + 8 + 34,
  ladder: 12 + 9 + lineBox(13),
  route: 34,
};

const FOOTER = {
  facts: lineBox(12) + 5 + lineBox(17),
  finePrintGap: 16,
  finePrintLine: lineBox(11.5, 1.45),
  finePrintSize: 11.5,
  finePrintWidth: 640,
  qr: 78,
};

const COVERED = {
  above: 34,
  label: lineBox(12),
  listGap: 10,
  readouts: lineBox(12) + 6 + 40,
  rowGap: 8,
  topicLine: lineBox(14.5, 1.4),
  topicSize: 14.5,
};

export const TOPICS = {
  check: 16,
  checkGap: 9,
  columnGap: 40,
  columns: 3,
  width: 900,
};

export const TOPIC_COLUMN_WIDTH =
  (TOPICS.width - TOPICS.columnGap * (TOPICS.columns - 1)) / TOPICS.columns;

const TOPIC_TEXT_WIDTH = TOPIC_COLUMN_WIDTH - TOPICS.check - TOPICS.checkGap;

/** Wide scripts take a full em; Geist's Latin averages a little over half of one. */
const WIDE_CHARACTER =
  /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}＀-￯]/u;

const EM_WIDTH = { narrow: 0.56, wide: 1 };

/** A rough line count for text Satori wraps, used only to decide what fits. */
export function estimateLines({
  fontSize,
  text,
  width,
}: {
  fontSize: number;
  text: string;
  width: number;
}): number {
  const ems = [...text].reduce(
    (sum, char) => sum + (WIDE_CHARACTER.test(char) ? EM_WIDTH.wide : EM_WIDTH.narrow),
    0,
  );

  return Math.max(1, Math.ceil((ems * fontSize) / width));
}

export type SheetCovered =
  | { kind: "readouts" }
  | { kind: "topics"; topics: readonly string[] }
  | null;

export type SheetGraph = keyof typeof SHEET_GRAPHS;

function getTopicRowLines(topics: readonly string[]): number[] {
  const lines = topics.map((topic) =>
    estimateLines({ fontSize: COVERED.topicSize, text: topic, width: TOPIC_TEXT_WIDTH }),
  );

  return Array.from({ length: Math.ceil(lines.length / TOPICS.columns) }, (_row, row) =>
    Math.max(...lines.slice(row * TOPICS.columns, (row + 1) * TOPICS.columns)),
  );
}

function getCoveredHeight(covered: SheetCovered): number {
  if (!covered) {
    return 0;
  }

  if (covered.kind === "readouts") {
    return COVERED.above + COVERED.readouts;
  }

  const rows = getTopicRowLines(covered.topics);
  const lines = rows.reduce((sum, rowLines) => sum + rowLines, 0);
  const list = lines * COVERED.topicLine + COVERED.rowGap * (rows.length - 1);

  return COVERED.above + COVERED.label + COVERED.listGap + list;
}

function getFooterHeight(finePrint: string): number {
  const finePrintLines = estimateLines({
    fontSize: FOOTER.finePrintSize,
    text: finePrint,
    width: FOOTER.finePrintWidth,
  });

  return Math.max(
    FOOTER.qr,
    FOOTER.facts + FOOTER.finePrintGap + finePrintLines * FOOTER.finePrintLine,
  );
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
  graph: SheetGraph;
  nameHeight: number;
  titleHeight: number;
}): number {
  const fixed = SHEET_PARTS.reduce((sum, part) => sum + part.above + part.height, 0);

  const height =
    fixed +
    nameHeight +
    titleHeight +
    getCoveredHeight(covered) +
    SHEET_GRAPHS[graph] +
    getFooterHeight(finePrint);

  return height - SHEET_CONTENT_HEIGHT;
}

/** The covered block's fallbacks, in the order the design gives way: all six, the first two, none. */
export function getCoveredFallbacks(covered: SheetCovered): SheetCovered[] {
  if (covered?.kind !== "topics") {
    return [covered, null];
  }

  return [covered, { kind: "topics", topics: covered.topics.slice(0, 2) }, null];
}

export const POST = {
  height: 1350,
  inset: 40,
  paddingBottom: 64,
  paddingTop: 72,
  paddingX: 76,
  width: 1080,
} as const;

const POST_CONTENT_HEIGHT = POST.height - POST.inset * 2 - POST.paddingTop - POST.paddingBottom;

const POST_PARTS = [
  { above: 0, height: lineBox(34) },
  { above: 0, height: lineBox(34) },
  { above: 16, height: 0 },
  { above: 34, height: 0 },
  { above: 76, height: 0 },
  { above: 52, height: 2 + 26 + lineBox(23) },
];

const POST_GRAPHS = { ladder: 14 + 9 + lineBox(21), route: 30 + 10 + 44 };

const POST_STATS = 60 + 80 + 10 + lineBox(25);

/** How far the post's parts run past its sheet, in px; zero or less fits. */
export function getPostOverflow({
  graph,
  hasStats,
  nameHeight,
  titleHeight,
}: {
  graph: keyof typeof POST_GRAPHS;
  hasStats: boolean;
  nameHeight: number;
  titleHeight: number;
}): number {
  const fixed = POST_PARTS.reduce((sum, part) => sum + part.above + part.height, 0);

  const height =
    fixed + nameHeight + titleHeight + POST_GRAPHS[graph] + (hasStats ? POST_STATS : 0);

  return height - POST_CONTENT_HEIGHT;
}
