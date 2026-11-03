/*
 * The design's numbers (design.md sections 3 and 4), read by both the drawing and the fit rules. The
 * sheet is in u, 1/1123 of its width (1 u = 1 px of A4 at 96 dpi); the share pictures in pixels.
 */

/** A name or a title: its box and the sizes it steps down through to fit its lines. */
export type TextSpec = {
  above: number;
  largest: number;
  letterSpacing: number;
  lineHeight: number;
  lines: number;
  smallest: number;
  weight: number;
  width: number;
};

export const TEXT = {
  bodyLineHeight: 1.43,
  placeholderWeight: 560,
  sizeStep: 2,
  smallestSize: 20,
} as const;

export const SHEET = {
  brand: { gap: 10, logo: 30, size: 22 },
  covered: {
    above: 34,
    labelGap: 6,
    labelSize: 12,
    listGap: 10,
    moreGap: 4,
    readoutGap: 56,
    readoutSize: 40,
    rowGap: 8,
  },
  footer: {
    above: 30,
    columnGap: 28,
    factGap: 44,
    factLabelGap: 5,
    finePrintGap: 16,
    finePrintLineHeight: 1.45,
    finePrintSize: 11.5,
    finePrintWidth: 640,
    labelSize: 12,
    qr: 78,
    rule: 1,
    ruleGap: 22,
    valueSize: 17,
    verifyBottom: 2,
    verifyGap: 5,
    verifySize: 14.5,
  },
  graph: { above: 26 },
  height: 2480,
  kind: { above: 84, lineHeight: 1.2, size: 20 },
  ladder: { bandGap: 10, cellGap: 3, cellHeight: 12, labelGap: 9, labelSize: 13, radius: 3 },
  marginX: 72,
  marginY: 49,
  meta: {
    above: 16,
    chipHeight: 24,
    chipPadding: 8,
    chipRadius: 6,
    chipSize: 13,
    gap: 10,
    size: 15,
  },
  name: {
    above: 16,
    largest: 92,
    letterSpacing: -0.045,
    lineHeight: 1.02,
    lines: 2,
    smallest: 44,
    weight: 650,
    width: 979,
  },
  route: {
    height: 34,
    labelGap: 8,
    labelHeight: 18,
    labelSize: 12.5,
    ring: 6.5,
    square: 7,
    squareRadius: 3,
    station: 3.6,
    stroke: 3,
    tick: 1.5,
    width: 979,
  },
  /** Two pixels per unit: twice the widest place a certificate shows on screen. */
  screenHeight: 1588,
  screenWidth: 2246,
  title: {
    above: 26,
    largest: 40,
    letterSpacing: -0.03,
    lineHeight: 1.14,
    lines: 3,
    smallest: 24,
    weight: 620,
    width: 860,
  },
  topics: {
    check: 16,
    checkGap: 9,
    checkTop: 2.5,
    columnGap: 40,
    columns: 3,
    lineHeight: 1.4,
    shownAfterOverflow: 2,
    size: 14.5,
    width: 900,
  },
  units: 1123,
  width: 3508,
} as const;

/** The sheet's pixels per design unit, at print and on screen. */
export const SHEET_SCALES = {
  print: SHEET.width / SHEET.units,
  screen: SHEET.screenWidth / SHEET.units,
} as const;

/** The paper share pictures: the certificate's white sheet on the pale ground. */
export const SHARE = {
  link: {
    bottom: { above: 18, size: 21 },
    brand: { gap: 10, logo: 38, size: 29 },
    graph: { above: 40 },
    height: 630,
    inset: 28,
    kind: { size: 25 },
    ladder: { bandGap: 10, cellGap: 3, cellHeight: 14, labelGap: 9, labelSize: 21, radius: 4 },
    name: {
      above: 0,
      largest: 96,
      letterSpacing: -0.045,
      lineHeight: 1,
      lines: 2,
      smallest: 60,
      weight: 650,
      width: 1032,
    },
    padding: { bottom: 38, top: 44, x: 56 },
    radius: 8,
    route: {
      height: 34,
      labelGap: 0,
      labelHeight: 0,
      labelSize: 0,
      ring: 8,
      square: 9,
      squareRadius: 3,
      station: 4.5,
      stroke: 4,
      tick: 1.5,
      width: 1032,
    },
    title: {
      above: 18,
      largest: 42,
      letterSpacing: -0.03,
      lineHeight: 1.12,
      lines: 2,
      smallest: 32,
      weight: 600,
      width: 1032,
    },
    width: 1200,
  },
  post: {
    bottom: { above: 52, rule: 2, ruleGap: 26, size: 23 },
    brand: { gap: 10, logo: 44, size: 34 },
    graph: { above: 76 },
    height: 1350,
    inset: 40,
    kind: { size: 34 },
    ladder: { bandGap: 10, cellGap: 3, cellHeight: 14, labelGap: 9, labelSize: 21, radius: 4 },
    name: {
      above: 16,
      largest: 156,
      letterSpacing: -0.05,
      lineHeight: 0.98,
      lines: 3,
      smallest: 76,
      weight: 650,
      width: 848,
    },
    padding: { bottom: 64, top: 72, x: 76 },
    radius: 10,
    route: {
      height: 44,
      labelGap: 10,
      labelHeight: 30,
      labelSize: 21,
      ring: 9,
      square: 10,
      squareRadius: 3,
      station: 5,
      stroke: 4.5,
      tick: 1.5,
      width: 848,
    },
    stats: { above: 60, gap: 72, labelGap: 10, labelSize: 25, size: 80, unitGap: 8, unitSize: 34 },
    title: {
      above: 34,
      largest: 60,
      letterSpacing: -0.032,
      lineHeight: 1.1,
      lines: 3,
      smallest: 38,
      weight: 610,
      width: 848,
    },
    width: 1080,
  },
  shadow: { blur: 30, offset: 12, spread: -12 },
} as const;

export const CERTIFICATE_SIZES = {
  link: { height: SHARE.link.height, width: SHARE.link.width },
  post: { height: SHARE.post.height, width: SHARE.post.width },
  print: { height: SHEET.height, width: SHEET.width },
  screen: { height: SHEET.screenHeight, width: SHEET.screenWidth },
} as const;

export function lineBox(fontSize: number, lineHeight: number = TEXT.bodyLineHeight): number {
  return fontSize * lineHeight;
}
