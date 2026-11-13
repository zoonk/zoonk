export type Pattern = {
  avoid: string[];
  follow: string[];
  id: string;
  summary: string;
  title: string;
};

export const PATTERNS: readonly Pattern[] = [
  {
    avoid: [
      "A second paragraph, or the same fact twice on a screen.",
      "How Zoonk picks, counts, saves or schedules, where the learner needs what they get.",
      "A caveat on the screen where the learner decides to start: say it where and when it applies.",
      "A button that names the next screen, a duration or a consequence (Continue to daily time).",
      "A count or a system state shown because we have it (Questions on 2 of 18 subjects).",
      "A word no earlier screen taught (sitting, checked, daily time).",
    ],
    follow: [
      "The title says the screen's one message: what the learner gets or does here. One thing leads; everything else supports it or leaves.",
      "Between the title and the main action: one sentence (20 words at most) and one line of facts (three at most). More becomes a step, or goes behind one Details link.",
      "A list row is a title and at most one short line. A result leads with one number or one sentence.",
      "A button is a verb the learner already knows, in one to three words: Start, Continue, Skip, Save, Try again.",
      "A product term (plan, focus, phase, Brain Power) appears only on or after the screen that shows what it is.",
      "This budget is for the product's own screens. Marketing pages (the landing, the catalog, public course pages, pricing, the blog) are read by someone deciding whether to start, and follow their own standard: more text in order, one action repeated, no insider words.",
      "The full rules are in the `zoonk-design` skill: Words, Marketing pages and The first-glance test.",
    ],
    id: "words",
    summary: "One message per screen, in the learner's words, with one thing leading.",
    title: "Words and hierarchy",
  },
  {
    avoid: [
      "A colored button.",
      "Two primaries in one area.",
      "An underlined word for a screen's main or secondary action.",
    ],
    follow: [
      "One main action per area, inverted (`Button`); secondary actions outline, tertiary ghost.",
      "An action inside a sentence (Take the test, Try again, Undo after a memory change) is a word (the `link` variant): the text color, underlined, at the size of the text around it.",
      "A quiet option under a task's main action (another try, the details, Undo after a result) is a ghost button on its own row (`TASK_OPTION_CLASS`), never an underlined word.",
      "The main action shows its key as a keycap on pointer devices (`ShortcutKbd`).",
      "Buttons side by side are one height, 8px apart (see Control heights under Spacing and shape).",
    ],
    id: "actions",
    summary: "The main action is the text color, the strongest thing on the screen.",
    title: "Actions",
  },
  {
    avoid: [
      "An underlined or boxed tab.",
      "A heavier weight or a thicker border on the current item: it moves its neighbors.",
      "A filled button for the current view of a list.",
    ],
    follow: [
      "The current tab is the navigation's `muted` fill, the same mark as the sidebar's current page: `Tabs`, or `TAB_CLASS` and `TAB_LIST_CLASS` for tabs that are links.",
      "The current tab's fill reaches 10px past the column, like a highlighted row, so the first tab's label starts on the title's edge.",
      "A pick is a 2px ring in the text color on its tint (`ChoiceList`, `AnswerOption`).",
      "A state change moves nothing: hover, focus, current, busy and disabled keep a control's size and its neighbors' place.",
    ],
    id: "current",
    summary: "Where you are and what you picked, each drawn one way in every app.",
    title: "Current and picked",
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
      "A count, a percent and a meter that say the same thing: pick one.",
      "A number shown because we have it: it stays only when it changes what the learner does next.",
    ],
    follow: [
      "One big number per block (`BigQuantity`), its unit small and muted.",
      "Under it a meter of parts sized by what they measure (`MeterParts`): progress blue, the learner's place as a blue ring, a kind in its hue, the rest on the track.",
      "The day's blocks are equal parts (`DayMeter`), the same meter on Today and at every block's end inside a session, where only the block just finished fills.",
      "At a task's end, under its title (`MomentHeader`), `MomentReadouts`: the score and the Brain Power earned (`BrainPowerReadout`, its violet number large and its words small).",
      "On a result's tiles (`StatTile`), the icon takes its stat's tone and Brain Power's number its violet, as every Brain Power amount.",
    ],
    id: "readouts",
    summary: "The one number that matters, and what it's made of.",
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
      "A row's mark is centered on a row of one or two lines and sits on the first line of three or more (`ListRowLeading`). Every mark takes the same 16px box, so labels start on one edge.",
      "A row that opens a page ends in a chevron on the column's edge (`ListRowChevron`).",
    ],
    id: "structure",
    summary: "Fewer boxes: content sits on the page.",
    title: "Lists and panels",
  },
  {
    avoid: [
      "A subject's color washed over a band.",
      "Bands inside the app's pages, which stay on the page.",
      "Bands on a course's, a chapter's or a lesson's page, whose parts Route's line separates.",
      "Two neighboring parts on the same tone.",
    ],
    follow: [
      "Alternate `ground` and the page between a public page's parts (the landing, pricing); the first screen's one white sheet (`card`) sits on `ground`.",
      "A public page may close on an inverted band holding its one action: ink in light (`bg-foreground text-background`), a raised band with a hairline in dark (`bg-card`), since a light band glares on a dark page.",
    ],
    id: "bands",
    summary: "A public page's parts read apart by neutral tone steps, never by color.",
    title: "Bands",
  },
  {
    avoid: [
      "The line where nothing is an order: the catalog's grid, the landing, statistics.",
      "The line at full strength for a visitor, who has traveled none of it.",
      "A station for every row of a list that isn't the course's own order.",
    ],
    follow: [
      "`Route` down a course's page, a `RouteStop` per part with its `RouteTitle`: ink rings for the page's own parts, a square where it ends.",
      "The course's real stops (chapters, lessons) on the subject's soft rings (`RouteMark station=\"stop\"`), the page itself (this chapter, this lesson) on an ink ring.",
      "Levels and an exam's areas as `RouteZone` bands the line runs through, a capsule standing for their stops until opened.",
    ],
    id: "route",
    summary:
      "The public course family's line (`@zoonk/learn/route-line`): a pale line in the subject's color through the course's real order.",
    title: "Route's line",
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
