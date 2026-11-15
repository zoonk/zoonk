import { type Summary } from "./alignment-summary.mts";
import { type Part } from "./alignment-table.mts";

/**
 * What every platform writes for one screen and configuration, and what the one evaluator reads
 * (`REPORT-SHAPE.md` in the alignment build notes).
 */
/** `[x, y, width, height]` in the capture's logical units. */
export type Bounds = [number, number, number, number];

export type NotMeasured = "not measured";

export type CaptureElement = {
  id: string;
  piece: string;
  part: Part | "action" | "anchor" | "group" | "holder" | "row" | "unmeasured";
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
  /** A text's: how many lines it runs to. */
  lines?: number;
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
  /** A state pair's anchor: the same id in both captures of one screen. */
  anchor?: string;
  /** A group's: its layout runs right to left, so its start edge is the right one. */
  direction?: "ltr" | "rtl";
  /** A group's: "stack" when the platform grouped rows no piece frames; its findings are leads. */
  source?: "piece" | "stack";
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
  /** Leads the platform found itself (inferred groups, empty room, cut off, the state walk). */
  discovery?: AlignmentFinding[];
  findings?: AlignmentFinding[];
  summary?: Summary;
};
