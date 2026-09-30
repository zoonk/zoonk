import { type ActivityTolerance } from "./activity-schemas";

export type ActivityCell = string | number | null;

type ActivityLink = { from: string; to: string };

export type ActivityFormulaExample = { inputs: Record<string, number>; output: number };

/**
 * The end state that makes an interaction check correct, computed by code from the template's
 * fields (timelines sort by date, Punnett squares combine alleles, trees are walked), never
 * written by the model.
 */
export type ActivityExpectedAnswer =
  | { kind: "assignment"; pairs: Record<string, string> }
  | { kind: "curveShift"; curve: "demand" | "supply"; direction: "left" | "right" }
  | { kind: "formula"; examples: ActivityFormulaExample[]; tolerance: ActivityTolerance }
  | { kind: "grid"; cells: string[] }
  | { kind: "links"; links: ActivityLink[] }
  | { kind: "molecule"; elements: Record<string, number> }
  | { kind: "order"; ids: string[] }
  | { kind: "output"; output: string }
  | { kind: "pitchClasses"; pitchClasses: number[] }
  | { kind: "regex"; shouldMatch: string[]; shouldNotMatch: string[] }
  | { kind: "rhythm"; tapTimesMs: number[]; toleranceMs: number }
  | { kind: "rows"; columns: string[]; orderMatters: boolean; rows: ActivityCell[][] }
  | { kind: "selection"; ids: string[] }
  | { kind: "text"; accepted: string[] };
