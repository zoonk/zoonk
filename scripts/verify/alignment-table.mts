/**
 * The shared pieces whose parts must line up, and how. Each piece names its parts by the
 * `data-slot`s the pieces carry; Android and Apple name the same parts and relationships
 * (`REPORT-SHAPE.md` in the alignment build notes). Failures come only from these declarations; an
 * inferred group is a discovery lead.
 */
export type Part = "end" | "label" | "lead" | "mark" | "note" | "value";

export type Relation =
  | "end-edge"
  | "gap"
  | "label-start"
  | "lead-start"
  | "line"
  | "mark-axis"
  | "type";

/** How the web finds a piece in the page: selectors, as the pieces' `data-slot`s name them. */
export type WebPiece = {
  /** The group's element. */
  group: string;
  /** Its rows, from the group (`:scope`); a row inside another of the same group isn't one. */
  rows: string;
  /** Each part, inside a row. */
  parts: Partial<Record<Part, string>>;
  /** Inside the group: the drawn track whose end is the group's end edge, where it has one. */
  bar?: string;
};

/**
 * A piece every platform names the same in its captures. A native-only piece has no `web`; its
 * relations still come from here, since this table is the one place they're declared.
 */
export type Piece = { name: string; relations: Relation[]; web?: WebPiece };

const LIST_PARTS = {
  end: "svg.lucide-chevron-right, [data-slot=radio-group-item], [data-slot=checkbox], [role=switch]",
  label: "[data-slot=list-row-title], [data-slot=week-day-item]",
  lead: "[data-slot=week-day-date]",
  mark: "[data-slot=list-row-leading], [data-slot=list-row-icon]",
  note: "[data-slot=list-row-description]",
  value: "[data-slot=list-row-trailing]",
} satisfies WebPiece["parts"];

export const PIECES: Piece[] = [
  {
    name: "list-group",
    relations: ["label-start", "lead-start", "mark-axis", "end-edge", "gap", "type", "line"],
    web: {
      group: "[data-slot=list-group]",
      parts: LIST_PARTS,
      // `LIST_GROUP_CLASS`: rows are its children, or the items of one list inside.
      rows: ":scope > :not(ol, ul), :scope > :is(ol, ul) > *",
    },
  },
  {
    name: "choice-list",
    relations: ["label-start", "mark-axis", "end-edge", "gap", "type"],
    web: {
      group:
        "[data-slot=radio-group]:has(> [data-slot=choice-row]), [data-slot=choice-list]:has(> [data-slot=choice-row])",
      parts: LIST_PARTS,
      rows: ":scope > [data-slot=choice-row]",
    },
  },
  {
    name: "sidebar",
    relations: ["label-start", "mark-axis"],
    web: {
      group: "[data-slot=sidebar]",
      parts: { label: ":scope > :nth-child(2)", mark: ":scope > :first-child" },
      rows: "[data-slot=sidebar-item]",
    },
  },
  {
    name: "sidebar-stack",
    relations: ["gap"],
    web: {
      group: "[data-slot=sidebar-section], [data-slot=sidebar-footer]",
      parts: {},
      rows: "[data-slot=sidebar-item], a, button",
    },
  },
  {
    name: "plan-roadmap",
    relations: ["end-edge"],
    web: {
      bar: ":scope > [data-slot=meter-parts]",
      group: "[data-slot=plan-roadmap]:has(> [data-slot=meter-parts])",
      parts: { end: "svg.lucide-chevron-right", value: "[data-slot=plan-roadmap-when]" },
      rows: ":scope > [data-slot=plan-roadmap-line]",
    },
  },
  {
    name: "journey-path",
    // No gap: a phase row holds its open chapters under it. No type: a word stands in a date's
    // place on purpose ("Won", "Today", "Date to be confirmed").
    relations: ["label-start", "mark-axis", "end-edge", "line"],
    web: {
      group: "[data-slot=journey-path-list], [data-slot=path-nested]",
      parts: {
        end: "svg.lucide-chevron-right, [data-slot=fold-chevron]",
        label: "[data-slot=path-row-title]",
        mark: "[data-slot=path-row-mark]",
        note: "[data-slot=path-row-note]",
        value: "[data-slot=path-row-value], [data-slot=phase-when], [data-slot=plan-date]",
      },
      rows: "[data-slot=path-row]",
    },
  },
  // Android's wait screens name these; the web's wait pieces aren't marked yet.
  { name: "wait-content", relations: ["gap"] },
  { name: "generation-wait", relations: ["gap"] },
];

/** Each piece's declared relations, by the name every platform's captures use. */
export const DECLARATIONS = new Map(
  PIECES.map((piece) => [piece.name, new Set<string>(piece.relations)]),
);

/** A main action's fill: `Button`'s `default` variant. */
export const FILLED_ACTION = "[data-slot=button][data-variant=default]";

/** What covers the page and becomes the surface its own actions are counted on. */
export const SURFACES =
  "[role=dialog][aria-modal=true], [role=alertdialog], [data-slot=dialog-content], [data-slot=sheet-content]";

/**
 * Exceptions to a declared relationship. A detector's correction belongs in the read itself; an
 * exception to a craft rule is the user's alone to grant, so each names who granted it, the rule,
 * the piece, the scenario and the configuration it covers.
 */
export type AlignmentException = {
  configuration: string;
  grantedBy: "user";
  piece: string;
  reason: string;
  relation: Relation | "one-filled";
  scenario: string;
};

export const EXCEPTIONS: AlignmentException[] = [];
