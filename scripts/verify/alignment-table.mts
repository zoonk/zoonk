/**
 * The shared pieces whose parts must line up, and how. Each piece names its parts by the
 * `data-slot`s the pieces carry; Android and Apple name the same parts and relationships
 * (`REPORT-SHAPE.md` in the alignment build notes). Failures come only from these declarations; an
 * inferred group is a discovery lead.
 */
export const PART_NAMES = ["end", "label", "lead", "mark", "note", "value"] as const;

export type Part = (typeof PART_NAMES)[number];

export type Relation =
  | "end-edge"
  | "even"
  | "gap"
  | "label-start"
  | "lead-start"
  | "line"
  | "mark-axis"
  | "room"
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
  /** Parts the group holds outside its rows (a bar's note over its buttons), read from the group. */
  groupParts?: Partial<Record<Part, string>>;
  /** Its rows are those that draw words, and a group with none has nothing to compare. */
  words?: boolean;
};

/**
 * A piece every platform names the same in its captures. A native-only piece has no `web`; its
 * relations still come from here, since this table is the one place they're declared.
 */
type Piece = { name: string; relations: Relation[]; web?: WebPiece };

const LIST_PARTS = {
  end: "svg.lucide-chevron-right, [data-slot=fold-chevron], [data-slot=radio-group-item], [data-slot=checkbox], [role=switch]",
  label: "[data-slot=list-row-title], [data-slot=week-day-item]",
  lead: "[data-slot=week-day-date]",
  mark: "[data-slot=list-row-leading], [data-slot=list-row-icon]",
  note: "[data-slot=list-row-description]",
  value: "[data-slot=list-row-trailing]",
} satisfies WebPiece["parts"];

/**
 * What a list and its rows are for every probe. A row is what `LIST_GROUP_CLASS` divides: the
 * group's children, or the items of one list inside, whatever slot a row carries (`list-row`,
 * the first week's `week-day`).
 */
export const LIST_GROUP = {
  group: "[data-slot=list-group]",
  rows: ":scope > :not(ol, ul), :scope > :is(ol, ul) > *",
};

const PIECES: Piece[] = [
  {
    name: "list-group",
    relations: ["label-start", "lead-start", "mark-axis", "end-edge", "gap", "type", "line"],
    web: { ...LIST_GROUP, parts: LIST_PARTS },
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
      group: "[data-slot=sidebar]:not([data-sidebar-collapsed] *)",
      parts: { label: ":scope > :nth-child(2)", mark: ":scope > :first-child" },
      rows: "[data-slot=sidebar-item]",
      // A row whose name hasn't streamed in yet (Buddy's, at a first paint) only holds its room.
      words: true,
    },
  },
  // Collapsed, the sidebar is an icon rail: its labels are for screen readers and its names show
  // in tooltips, so only its icons' axis is compared.
  {
    name: "sidebar-rail",
    relations: ["mark-axis"],
    web: {
      group: "[data-sidebar-collapsed] [data-slot=sidebar]",
      parts: { mark: ":scope > :first-child" },
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
      // A meter that draws its line; the reveal's phone meter has none, its list dating each phase.
      group:
        "[data-slot=plan-roadmap]:has(> [data-slot=meter-parts]):has(> [data-slot=plan-roadmap-line])",
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
        label: "[data-slot=path-row-words] > :first-child",
        mark: "[data-slot=path-row-mark], [data-slot=status-mark]",
        note: "[data-slot=path-row-words] > :not(:first-child)",
        value: "[data-slot=path-row-value]",
      },
      rows: "[data-slot=path-row]",
    },
  },
  // A top bar's buttons and text links that are actions share one type. The back link is its own
  // part, quieter by the kit's design, and an icon alone has no type to compare.
  {
    name: "page-top-bar",
    relations: ["type"],
    web: {
      group: "[data-slot=page-top-bar]",
      parts: { label: ":scope" },
      rows: "[data-slot=page-top-end] :is(a, button):not(:has([data-slot=avatar]))",
      words: true,
    },
  },
  // A screen's main action: its note sits as far from its line as its buttons sit from the note.
  {
    name: "bottom-bar",
    relations: ["room"],
    web: {
      group: "[data-slot=bottom-bar]",
      groupParts: {
        end: ":scope > [data-slot=bottom-bar-row] > :first-child",
        note: ":scope > [data-slot=bottom-bar-note] > div > div",
      },
      parts: {},
      rows: ":scope > [data-slot=bottom-bar-row]",
    },
  },
  // A guess's worked numbers, a small table (#15): the labels start on one edge, and the numbers,
  // ending on one edge before them, share one type.
  {
    name: "guess-workings",
    relations: ["label-start", "type"],
    web: {
      group: "[data-slot=guess-workings]",
      parts: { label: "[data-slot=guess-working-label]", value: "[data-slot=guess-working-value]" },
      rows: ":scope > li",
    },
  },
  // Siblings of one kind side by side share a top and a height (craft E6): a page's stat tiles,
  // and a tab list's tabs, whichever way the list is written.
  {
    name: "stat-tiles",
    relations: ["even"],
    web: { group: "[data-slot=stat-tiles]", parts: {}, rows: ":scope > li" },
  },
  {
    name: "tab-list",
    relations: ["even"],
    web: {
      group: "[role=tablist], [data-slot=tabs-list], [data-tabs]",
      parts: {},
      rows: ":scope > :is(a, button, [role=tab]), :scope > li > :is(a, button)",
    },
  },
  // A row of marks, one a day: declared so it starts and ends on its column (`spanLeads`).
  {
    name: "week-rings",
    relations: [],
    web: { group: "[data-slot=week-rings]", parts: {}, rows: ":scope > *" },
  },
  // Android's wait screens name these; the web's wait pieces aren't marked yet.
  { name: "wait-content", relations: ["gap"] },
  { name: "generation-wait", relations: ["gap"] },
];

/** Each piece's declared relations, by the name every platform's captures use. */
export const DECLARATIONS = new Map(
  PIECES.map((piece) => [piece.name, new Set<string>(piece.relations)]),
);

/**
 * Controls that can be a main action. One is filled when the shared button's variant says so: each
 * variant of `buttonVariants` declares `--button-variant`, on a `Button` and on a link drawn as one
 * alike. One filled action per surface. A link with the same words to the same place, or a button
 * whose piece names its action (`data-action-name`, a goal box drawn at a page's top and its end),
 * offered again counts once; every other action counts, each submit button included.
 */
const ACTIONS = "a, button, [role=button]";

/** What covers the page and becomes the surface its own actions are counted on. */
const SURFACES =
  "[role=dialog][aria-modal=true], [role=alertdialog], [data-slot=dialog-content], [data-slot=sheet-content]";

/**
 * The page's columns (craft E7): a drawn box starts and ends on its closest column's content edges,
 * or bleeds as E7 allows. A frame's main column, the column beside an aside, the aside, and `Page`.
 */
const COLUMNS =
  "[data-slot=learn-shell-main], [data-slot=page-with-aside] > div, [data-slot=page-aside], [data-slot=page], [data-slot=task-body]";

/** What `readAlignment` reads a web page by. */
export const WEB_TABLE = {
  actions: ACTIONS,
  columns: COLUMNS,
  panels: "[data-slot=page-aside]",
  pieces: PIECES.flatMap((piece) => (piece.web ? [{ name: piece.name, web: piece.web }] : [])),
  pinned: "[data-slot=bottom-bar]",
  surfaces: SURFACES,
};

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
