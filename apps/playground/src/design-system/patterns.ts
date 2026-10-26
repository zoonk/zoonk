/** The core components and patterns: one way to draw each thing, with what to do and what not. */

/** A pattern: one way to draw one thing, with what to do and what not to. */
export type Pattern = {
  avoid: string[];
  follow: string[];
  id: string;
  summary: string;
  title: string;
};

export const PATTERNS: readonly Pattern[] = [
  {
    avoid: ["A colored button.", "Two primaries in one area.", "An underlined link as a button."],
    follow: [
      "One main action per area, inverted (`Button`); secondary actions outline, tertiary ghost.",
      "The main action shows its key as a keycap on pointer devices (`ShortcutKbd`).",
    ],
    id: "actions",
    summary: "The main action is the text color, the strongest thing on the screen.",
    title: "Actions",
  },
  {
    avoid: [
      "A blue ring for a pick: blue means right.",
      "Coloring the words of an option.",
      "Color without its word: a checked option always says Correct or Your answer.",
    ],
    follow: [
      "At rest the stronger line; picked a 2px ring in the text color on its tint.",
      "Checked: the right answer's ring and tint in blue, a wrong pick's in pink-red, each with its word.",
    ],
    id: "answers",
    summary:
      "An answer's anatomy (`AnswerOption`, `ANSWER_TONE`): checking always changes its color.",
    title: "Answers",
  },
  {
    avoid: [
      "Striking a done name through.",
      "A second check style.",
      "A kind's dot in a list of one kind.",
    ],
    follow: [
      "`StatusMark`: a blue check once done, the learner's blue dot with a halo for the next one, a faint dot ahead.",
      "The next row sits on the neutral highlight; a done row is one quiet line.",
    ],
    id: "status",
    summary: "Where a thing stands, the same marks in every list.",
    title: "Status",
  },
  {
    avoid: ["A kind's color in navigation.", "Hue alone: the icon's shape tells kinds apart."],
    follow: [
      "`KindMark` where kinds sit side by side (the day's queue, the missions, a plan's events).",
      "Every kind's color and icon from `KIND_MARKS`; a new kind gets its row and a hue no meaning uses.",
    ],
    id: "kinds",
    summary: "What a thing is, by its icon in its hue.",
    title: "Kinds",
  },
  {
    avoid: [
      "A number without its words.",
      "A meter part colored for decoration: each color is a meaning or a kind.",
    ],
    follow: [
      "One big number per block (`BigQuantity`), its unit small and muted.",
      "Under it a meter of parts sized by what they measure (`MeterParts`): progress blue, the learner's place as a blue ring, a kind in its hue, the rest on the track.",
    ],
    id: "readouts",
    summary: "Readouts with meters: the number that matters and what it's made of.",
    title: "Readouts and meters",
  },
  {
    avoid: [
      "A solid tab in the subject's color: too strong.",
      "A subject's color on a surface, a button or progress.",
    ],
    follow: [
      "`SubjectLabel` over a course's title and on its catalog card: the name on a soft tint.",
      "`SubjectGlyph` beside a subject's name in a list or key.",
    ],
    id: "subjects",
    summary: "A course's subject, named once, subtly.",
    title: "Subject labels",
  },
  {
    avoid: [
      "A panel inside a panel.",
      "A shadow on content.",
      "A box around a list that sits on the page.",
    ],
    follow: [
      "Lists are flat rows with hairlines (`ListGroup`), the current row highlighted past the column's edges.",
      "A panel (`Surface`) holds one self-contained thing: a preview, a notice, the missions.",
    ],
    id: "structure",
    summary: "Fewer boxes: content sits on the page.",
    title: "Lists and panels",
  },
  {
    avoid: [
      "A subject's color washed over a band.",
      "Bands inside the app's pages, which stay on the page.",
      "Two neighboring parts on the same tone.",
    ],
    follow: [
      "Alternate `ground` and the page between a public page's parts; the first screen's one white sheet (`card`) sits on `ground`.",
      "A public page may close on an inverted band holding its one action: ink in light (`bg-foreground text-background`), a raised band with a hairline in dark (`bg-card`), since a light band glares on a dark page.",
    ],
    id: "bands",
    summary: "A public page's parts read apart by neutral tone steps, never by color.",
    title: "Bands",
  },
  {
    avoid: ["Uppercase section names on a page.", "A heading with no content under it."],
    follow: [
      "`PageSectionTitle` for an app page's block, with its count in `PageSectionDetail`.",
      "`text-section` for a public page's part; `text-label` only inside a panel.",
    ],
    id: "titles",
    summary: "Titles, not labels.",
    title: "Section titles",
  },
];
