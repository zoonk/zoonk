import { type Summary } from "./alignment-summary.mts";
import { PART_NAMES } from "./alignment-table.mts";

/**
 * What every platform writes for one screen and configuration, and what the one evaluator reads
 * (`REPORT-SHAPE.md` in the alignment build notes).
 */
/** `[x, y, width, height]` in the capture's logical units. */
export type Bounds = [number, number, number, number];

export type NotMeasured = "not measured";

/**
 * Every part a capture's element may be, but an area the platform couldn't read: the one list the
 * probes' type and the validator's schema both take, so what a probe writes is what's read.
 */
export const ELEMENT_PARTS = [
  ...PART_NAMES,
  "action",
  "anchor",
  "bar",
  "fill",
  "group",
  "holder",
  "pinned",
  "row",
] as const;

export type CaptureElement = {
  id: string;
  piece: string;
  part: (typeof ELEMENT_PARTS)[number] | "unmeasured";
  group: string | null;
  row: string | null;
  bounds: Bounds;
  /** What it draws; null when it draws nothing, which makes it a holder of room. */
  ink: Bounds | NotMeasured | null;
  /** A text's first line, and its vertical metrics. */
  firstLine?: Bounds;
  baseline?: number | NotMeasured;
  capTop?: number | NotMeasured;
  capBottom?: number | NotMeasured;
  /**
   * The box `capTop` and `capBottom` bound: the face's capitals, or for a script with none
   * (Japanese, Korean) its ideographic face, read from a full-frame glyph in the same fonts.
   */
  textBox?: "capitals" | "ideographic face";
  /** An action's: drawn disabled. A disabled filled button still counts toward `one-filled`. */
  disabled?: boolean;
  /** A text's: how many lines it runs to. */
  lines?: number | NotMeasured;
  /** A row's: a supporting line sits under its label. */
  note?: boolean;
  type?: string;
  text?: string;
  name?: string;
  /** A group's or a row's: the edge its last drawn parts reach. */
  endEdge?: number | NotMeasured;
  /** A group's: the gap its piece lays out between rows. */
  gap?: number | NotMeasured;
  /**
   * A group's, when it is drawn at another size than it is laid out (a transform or a zoom): its
   * drawn width over its laid-out width. Its laid-out lengths and drawn positions don't compare.
   */
  layoutScale?: number;
  /** A row's: the gap its flow parent declares, which parent, and its margins before and after. */
  gapBefore?: number | NotMeasured;
  flow?: string;
  margins?: [number, number];
  /** An action's: its look, and the surface it is on ("page", or a dialog's or sheet's name). */
  variant?: string;
  surface?: string;
  /** An action's destination, when it is a link: the same words to the same place are one action. */
  target?: string;
  /**
   * A fill's (a drawn box that passes the page's column): the column's start and end, the frame's
   * (the page's whole room), and what it is: a row's "highlight", a "hairline", a "picture" or a
   * "box" (craft E7).
   */
  column?: [number, number];
  frame?: [number, number];
  kind?: "box" | "hairline" | "highlight" | "picture";
  /** A state pair's anchor: the same id in both captures of one screen. */
  anchor?: string;
  /** An anchor the platform couldn't place (a node it didn't find): the pair can't measure it. */
  unplaced?: boolean;
  /** A group's: its layout runs right to left, so its start edge is the right one. */
  direction?: "ltr" | "rtl";
  /** A group's: "stack" when the platform grouped rows no piece frames; its findings are leads. */
  source?: "piece" | "picture" | "stack";
  /** A row's: the one the learner is on (current, picked), which may set its words apart. */
  current?: boolean;
  /** A row's: the middle of what it lays out (inside a divider's border and its padding). */
  middle?: number | NotMeasured;
  /** A row's: its value moved under its label (large text), as the row piece does on purpose. */
  stacked?: boolean;
  /** An area the platform couldn't read (`"part": "unmeasured"`): why. */
  reason?: string;
};

export type Configuration = {
  size: string;
  width: number;
  height: number;
  pointer: "keys" | "touch";
  locale: string;
  textScale: number;
  scheme: string;
};

export type Capture = {
  version: 1;
  platform: "android" | "apple" | "web";
  scenario: string | null;
  screen: string;
  configuration: Configuration;
  unit: "dp" | "pt" | "px";
  scale: number;
  /**
   * The topmost dialog or sheet showing, or "page"; "not measured" when two surfaces overlap and
   * the page shows no dialog or sheet where they do, which fails `one-filled`.
   */
  activeSurface: string;
  /** False when the run reached the screen but not its scenario's proof (its words never showed). */
  reached?: boolean;
  /** A gallery of the pieces shown side by side, not a screen: one filled action isn't judged. */
  specimen?: boolean;
  elements: CaptureElement[];
};

export type Level = "discovery" | "fail" | "not-measured";

export type AlignmentFinding = {
  /** A relation's id (`alignment-table.mts`), `one-filled`, or a discovery lead's kind. */
  rule: string;
  piece: string;
  level: Level;
  /** The same wherever the fault happens: the report lists it once with its instances. */
  message: string;
  /** This instance: the rows and what was measured. */
  detail: string;
  scenario: string | null;
  screen: string;
  configuration: string;
  measured?: number;
  unit?: string;
  holder?: string;
  exception?: string;
};

export function configurationName({ locale, pointer, size, textScale }: Configuration) {
  return [size, pointer, locale === "en" ? "" : locale, textScale === 1 ? "" : `text ×${textScale}`]
    .filter(Boolean)
    .join(" ");
}

export type AlignmentFile = {
  captures: Capture[];
  /** The scenario ids this run was asked to capture: each must be captured, once, and known. */
  required?: string[];
  /** Leads the platform found itself (inferred groups, empty room, cut off, the state walk). */
  discovery?: AlignmentFinding[];
  findings?: AlignmentFinding[];
  summary?: Summary;
};
