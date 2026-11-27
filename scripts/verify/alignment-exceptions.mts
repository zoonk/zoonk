import { type PAGE_RULES } from "./alignment-capture.mts";
import { type Relation } from "./alignment-table.mts";

/**
 * Exceptions to a declared relationship. A detector's correction belongs in the read itself; an
 * exception to a craft rule is the user's alone to grant, so each names who granted it, or, for a
 * failure the base's capture of the same screen has too, the open issue that tracks its fix. Each
 * names the rule, the piece, the scenario and the configuration it covers, and caps the
 * measurement at the observed magnitude.
 */
export type AlignmentException = {
  configuration: string;
  /** A categorical failure, such as a lone last word, has no numeric measurement. */
  maxMeasured: number | null;
  piece: string;
  reason: string;
  relation: Relation | "column" | "one-filled" | (typeof PAGE_RULES)[number];
  scenario: string;
} & ({ grantedBy: "user" } | { issue: number });

export const EXCEPTIONS: AlignmentException[] = [
  {
    configuration: "phone touch en-US",
    issue: 3315,
    piece: "page",
    reason: "Android's answer field scrolls a long answer with no sign it continues, on main too",
    relation: "cut",
    scenario: "04-writing-may-not-fit",
  },
  {
    configuration: "phone touch en-US",
    issue: 3315,
    piece: "page",
    reason: "Android's answer field scrolls a long answer with no sign it continues, on main too",
    relation: "cut",
    scenario: "04-writing-over-limit",
  },
  {
    configuration: "laptop keys",
    issue: 3228,
    maxMeasured: 2.2,
    piece: "page",
    reason: "Start's laptop close button's ink misses the column edge, on main too",
    relation: "column",
    scenario: "/start",
  },
  {
    configuration: "laptop keys",
    issue: 2982,
    maxMeasured: 2,
    piece: "action",
    reason: "The Plan page shows the missed-days and post-exam actions filled on main too",
    relation: "one-filled",
    scenario: "/plan",
  },
  {
    configuration: "phone touch",
    issue: 3136,
    maxMeasured: 162.7,
    piece: "list-group",
    reason: "The expanded language phase's child rows count as a gap on iOS, on main too",
    relation: "gap",
    scenario: "plan-language-after-test-light",
  },
  {
    configuration: "phone touch",
    issue: 3136,
    maxMeasured: 162.7,
    piece: "list-group",
    reason: "The expanded language phase's child rows count as a gap on iOS, on main too",
    relation: "gap",
    scenario: "plan-language-after-test-dark",
  },
  {
    configuration: "phone touch",
    issue: 3268,
    maxMeasured: 6.31,
    piece: "list-group",
    reason:
      "A Plan row's share centers on its name and bar, which the line check reads as one line, on main too",
    relation: "line",
    scenario: "plan-module-taken-out-en",
  },
  {
    configuration: "phone touch pt",
    issue: 3268,
    maxMeasured: 6.31,
    piece: "list-group",
    reason:
      "A Plan row's share centers on its name and bar, which the line check reads as one line, on main too",
    relation: "line",
    scenario: "plan-module-taken-out-pt",
  },
  {
    configuration: "laptop keys",
    issue: 2832,
    maxMeasured: 10,
    piece: "page",
    reason: "The Plan's 10 px phase-row hover fill is read as a box on main too",
    relation: "column",
    scenario: "/plan",
  },
  {
    configuration: "phone touch",
    issue: 2929,
    maxMeasured: null,
    piece: "page",
    reason: "A far topic's row gives its title only the width its start line leaves, on main too",
    relation: "lone-word",
    scenario: "/plan/matematica-e-suas-tecnologias",
  },
  {
    configuration: "laptop keys",
    issue: 2944,
    maxMeasured: null,
    piece: "page",
    reason:
      "An out-of-plan subject's facts line wraps in the meter's column on the Plan, on main too",
    relation: "lone-word",
    scenario: "/plan",
  },
  {
    configuration: "laptop keys pt",
    issue: 2955,
    maxMeasured: null,
    piece: "page",
    reason: "A two-line phase name on the Plan's roadmap leaves one word alone, on main too",
    relation: "lone-word",
    scenario: "/pt/plan",
  },
  {
    configuration: "phone touch en-US",
    issue: 3006,
    maxMeasured: null,
    piece: "page",
    reason:
      "A long dialogue match card wraps greedily and leaves one word alone on Android, on main too",
    relation: "lone-word",
    scenario: "review-midway",
  },
  {
    configuration: "phone touch en-US",
    issue: 3006,
    maxMeasured: null,
    piece: "page",
    reason:
      "A long dialogue match card wraps greedily and leaves one word alone on Android, on main too",
    relation: "lone-word",
    scenario: "review-checked-after-a-miss",
  },
];
