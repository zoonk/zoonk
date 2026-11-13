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
      "A colored button.",
      "Two primaries in one area.",
      "An underlined word for a screen's main or secondary action.",
      "An icon beside the ⏎ keycap, or an arrow in a button.",
    ],
    follow: [
      "One main action per area, inverted (`Button`); secondary actions outline, tertiary ghost.",
      "An action inside a sentence (Take the test, Try again, Undo after a memory change) is a word (the `link` variant): the text color, underlined, at the size of the text around it. A quiet option under a task's main action (another try, the details, Undo after a result) is a ghost button on its own row (`TASK_OPTION_CLASS`), never an underlined word.",
      "A button shows its label and at most one glyph. The main action that Enter presses (`EnterButton`) shows the ⏎ keycap where there is a keyboard and its label alone on a touch screen. While it works the spinner takes the glyph's place, or covers the label, so nothing changes size.",
      "A forward glyph is a chevron (`FORWARD_ICON`), on the label's center line.",
    ],
    id: "actions",
    summary: "The main action is the text color, the strongest thing on the screen.",
    title: "Actions",
  },
  {
    avoid: [
      "A page that pads or pushes its own title down.",
      "A bare chevron with no name, or a second back link drawn by hand.",
      "An arrow for back.",
    ],
    follow: [
      "`PageTop` (or `PageTopBar` in a layout with `PAGE_HEADER_CLASS` in the page): 12px, the 44px bar, 12px, then the title, the same on a phone and a computer, whether or not the bar holds anything.",
      "`BackLink`: a chevron and the name of the page it goes back to, the mirror of a See all row, so both keep one gap between words and chevron.",
      "The link's chevron lines up with the title's first letter; the pull follows the title's type role, so no page sets it.",
      "A full-screen task keeps ✕ instead.",
    ],
    id: "page-top",
    summary: "Every page starts the same way: the way back, then the title close to the top.",
    title: "Page top",
  },
  {
    avoid: [
      "A main action at the top of a page, or under the content where it scrolls away.",
      "An error line inside the bar that makes it taller and moves its buttons.",
      "A second pinned bar built from classes.",
    ],
    follow: [
      "`BottomBar` holds a screen's one main action, pinned at the bottom on a phone and a computer; `BottomBarActions` is its row, buttons 8px apart, the main action last.",
      "What the last action couldn't do goes in `note`: it shows over the screen above the bar, and the buttons stay where they were.",
      "The frame tells the bar its padding and what is docked under it (`--page-gutter`, `--page-bottom`, `--page-dock`), so the same piece works in the app's shell and in a task.",
    ],
    id: "bottom-bar",
    summary: "The main action has one home: the bar at the bottom of the screen.",
    title: "Bottom bar",
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
      "The day's blocks are equal parts (`DayMeter`), one per block plus one for time held for lessons not on the list yet, so the meter, the count and the percent say one thing; Today and every block's end inside a session draw the same meter.",
      'At a task\'s end, under its title (`MomentHeader`), `MomentReadouts`: the score and the Brain Power earned (`BrainPowerReadout`, its violet number large and its words small), the facts on one mono line under them. Inside a session, today\'s progress follows: the count that matters ("2 of 8 done today", then "3 left today" past the midpoint) with its percent, and the day\'s meter, where only the block just finished fills.',
      "On a result's tiles (`StatTile`), the icon takes its stat's tone and Brain Power's number its violet, as every Brain Power amount.",
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
