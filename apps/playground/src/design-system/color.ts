/**
 * What each color token means and where it goes. The values live in
 * `packages/ui/src/styles/globals.css` (light, dark and both `prefers-contrast: more` modes); the
 * playground's `/design/color` page shows them live beside these words.
 */

import { BELT_GROUP } from "./belts";

/** A color token: its CSS variable in `globals.css` (`--name`, used as `bg-name`, `text-name`). */
export type ColorToken = {
  /** Where it never goes, when that's a mistake worth naming. */
  avoid?: string;
  /** What the color says. */
  meaning: string;
  name: string;
  /** The token it sits on, when that isn't the page (words on the main action). */
  on?: string;
  /** Read as words, so its contrast is checked against text's 4.5:1. */
  text?: boolean;
  /** A faint fill under something else, so it has no contrast of its own. */
  tint?: boolean;
  /** Where it goes, by component. */
  use: string;
};

export type ColorGroup = { id: string; intro: string; title: string; tokens: ColorToken[] };

export const COLOR_GROUPS: readonly ColorGroup[] = [
  {
    id: "surfaces",
    intro:
      "Neutral tone steps set a page's parts apart; color never does. In light the page and panels are both white and a panel reads by its hairline; in dark a panel is a step lighter than the page.",
    title: "Surfaces and lines",
    tokens: [
      {
        meaning: "The page.",
        name: "background",
        use: "Every page, the player, the white sheet on a ground band.",
      },
      {
        avoid: "Inside the app's pages, which stay on the page with rows and hairlines.",
        meaning: "A band that sets a public page's part apart from its neighbors.",
        name: "ground",
        use: "The landing's and a course's parts alternate ground and the page; a panel on it is a card.",
      },
      {
        avoid: "A panel inside another panel, a shadow.",
        meaning: "A panel holding one self-contained thing.",
        name: "card",
        use: "`Surface`, a catalog card, the missions card, a notice.",
      },
      {
        meaning: "An overlay.",
        name: "popover",
        use: "Menus, the command palette, popovers and sheets, with their one soft shadow.",
      },
      {
        meaning: "The quiet fill.",
        name: "muted",
        use: "The row the learner is on, a hover, a keycap, a skeleton.",
      },
      {
        meaning: "The third step: what's still to fill.",
        name: "surface-3",
        use: "A meter's or a bar's track, a cell not done yet, a mock sheet's answered squares.",
      },
      {
        avoid: "Restyling: the sidebar stays exactly as it is.",
        meaning: "The sidebar's own surface, a step dimmer than the page.",
        name: "sidebar",
        use: "`LearnAppSidebar` only, with `sidebar-accent` for its current item.",
      },
      {
        meaning: "A hairline.",
        name: "border",
        use: "Between rows, a panel's edge, a bar's bottom once the page scrolls.",
      },
      {
        meaning: "The stronger line.",
        name: "input",
        use: "Inputs, answer options at rest, secondary buttons, chips.",
      },
    ],
  },
  {
    id: "text",
    intro:
      "Three text steps, each AA on every surface it sits on in every mode. Size and weight lead the hierarchy; the steps only quiet what supports it.",
    title: "Text",
    tokens: [
      {
        meaning: "Titles and body.",
        name: "foreground",
        text: true,
        use: "Every title, row title and sentence.",
      },
      {
        meaning: "Supporting words.",
        name: "muted-foreground",
        text: true,
        use: "A row's second line, meta, trailing numbers, a readout's unit, a done row's name.",
      },
      {
        meaning: "Words that frame what's beside them.",
        name: "faint",
        text: true,
        use: "Eyebrows, list numbers, axis labels, labels inside a panel.",
      },
    ],
  },
  {
    id: "action",
    intro:
      "The main action is the text color, inverted: black in light, white in dark. One per area, and it's the strongest thing there.",
    title: "Action",
    tokens: [
      {
        avoid: "A colored button, a second primary in the same area.",
        meaning: "The main action.",
        name: "primary",
        use: "`Button` (default), Continue and Check in a task's action bar, Build my plan.",
      },
      {
        meaning: "Words on the main action.",
        name: "primary-foreground",
        on: "primary",
        text: true,
        use: "The main action's label and its keycap.",
      },
      {
        meaning: "Keyboard focus.",
        name: "ring",
        use: "Every focus outline; a focused pick shows both its ring and the outline.",
      },
    ],
  },
  {
    id: "own",
    intro:
      "What the learner picked before it's judged, in the text color. Checking turns it blue or pink-red, so a pick never looks right before it's checked.",
    title: "The learner's pick",
    tokens: [
      {
        avoid:
          "Blue, a button, a tab, a link, a hover, the learner's place (that's progress's blue).",
        meaning: "A pick before it's judged.",
        name: "selected",
        use: "A 2px ring on `selected-tint` (`ANSWER_TONE.picked`, `ChoiceList`, `Toggle`), a checked radio or checkbox.",
      },
      {
        meaning: "The faint fill under a pick.",
        name: "selected-tint",
        tint: true,
        use: "Under a picked answer, choice or toggle; none with more contrast.",
      },
      {
        meaning: "A check on a filled pick.",
        name: "selected-foreground",
        on: "selected",
        use: "A checked radio or checkbox.",
      },
    ],
  },
  {
    id: "meanings",
    intro:
      "Soft colors with one meaning each, the same on every screen. Fills, rings and icons take the plain token; words take its `-text` step. Color is never the only cue: a word, an icon or a shape says the same.",
    title: "Meanings",
    tokens: [
      {
        avoid: "A pick (`selected`), a button, decoration.",
        meaning:
          "Progress made (done, right, studied, reached, a day of activity) and where the learner is now, the edge of their progress.",
        name: "success",
        use: "Done: `DoneMark`, filled segments and cells, the week's rings, a right answer's ring and tint, activity squares, good news in a plan change, a call's stars (progress, not a prize, so never gold). The place: a ring (the day's block in progress, the current phase) or a dot with a halo (`StatusMark` next).",
      },
      {
        meaning: "Progress in words.",
        name: "success-text",
        text: true,
        use: "Correct, Studied, +4 this week.",
      },
      {
        avoid: "Calm failures (a page that didn't load), which stay neutral.",
        meaning: "Wrong or removed: a soft red leaning pink.",
        name: "destructive",
        use: "A wrong answer's ring and tint, a wrong segment, bad news in a plan change, a destructive action.",
      },
      {
        meaning: "Wrong or removed, in words.",
        name: "destructive-text",
        text: true,
        use: "Your answer on a wrong pick, a one-line inline error.",
      },
      {
        avoid: "A dot: an amber dot is review and practice.",
        meaning: "Look here: a flag, a suggestion, the one thing to improve.",
        name: "warning",
        use: "A suggestion's mark, a flagged question, Appears a lot, an almost-right answer.",
      },
      {
        meaning: "Look here, in words.",
        name: "warning-text",
        text: true,
        use: "A flag's chip, the one thing to improve.",
      },
      {
        avoid: "Anything that isn't Brain Power.",
        meaning: "Brain Power, the reward for learning, and nothing else.",
        name: "brain",
        use: "Every reward amount's mark, the missions' track, the mark on the row a mission opens, the reward lit once earned.",
      },
      {
        meaning: "Brain Power in words.",
        name: "brain-text",
        text: true,
        use: "+50, +18 Brain Power.",
      },
      { meaning: "The buddy's Energy.", name: "energy", use: "Its meter, its bolt, its calendar." },
    ],
  },
  {
    id: "kinds",
    intro:
      "What a thing is, by its icon in its job's hue from `KIND_MARKS` (`@zoonk/learn/kind-tile`), shown where kinds sit side by side in one list. Kinds doing the same job share a hue and differ by icon. A lesson, the default, is neutral; a list of one kind marks state instead.",
    title: "Kinds",
    tokens: [
      {
        meaning: "Going back over what was learned: a review, practice or the mistakes notebook.",
        name: "kind-review",
        use: "`KindMark` review, practice and mistakes, each with its own icon; their part of a meter.",
      },
      {
        meaning: "Testing what the learner knows: a mock exam or the Trickster's challenge.",
        name: "kind-mock",
        use: "`KindMark` mock and challenge, each with its own icon; a mock's line, their part of a meter.",
      },
      {
        meaning: "Making something yourself: a conversation or an essay.",
        name: "kind-conversation",
        use: "`KindMark` conversation and essay.",
      },
      { meaning: "A mind map.", name: "kind-mind-map", use: "`KindMark` mind map." },
    ],
  },
  {
    id: "subjects",
    intro:
      "What a course is about. One table in `globals.css` gives each category a hue; an element with `data-subject` (`getSubject`) gets three roles from it. Subtle on purpose: a label and a line, never a surface.",
    title: "Subjects",
    tokens: [
      {
        avoid: "A button, a pick, progress, a page's background.",
        meaning: "The subject's own color.",
        name: "subject",
        use: "Its line on a course page, `SubjectGlyph` beside its name, a card's thin stroke.",
      },
      {
        meaning: "Behind the subject's name.",
        name: "subject-tint",
        tint: true,
        use: "`SubjectLabel`.",
      },
      {
        meaning: "The subject's name.",
        name: "subject-text",
        on: "subject-tint",
        text: true,
        use: "`SubjectLabel`'s words.",
      },
    ],
  },
  {
    id: "viz",
    intro:
      "Three hues for data inside interactive activities, apart from every meaning outside the canvas. Never blue (progress) or violet (Brain Power).",
    title: "Activity visuals",
    tokens: [
      {
        meaning: "The thing the learner moves.",
        name: "viz-accent",
        text: true,
        use: "A slider's point, a moved body.",
      },
      {
        meaning: "A target, a highlight or a prize.",
        name: "viz-highlight",
        text: true,
        use: "A target line, look here inside a chart.",
      },
      {
        meaning: "A second series.",
        name: "viz-secondary",
        text: true,
        use: "The other line or set in a comparison.",
      },
    ],
  },
  BELT_GROUP,
];

/** How color is used, whatever the token. */
export const COLOR_RULES: readonly string[] = [
  "Neutral by default: tone steps and hairlines separate a page's parts; color only signals.",
  "One meaning per hue, the same on every screen. Before giving something a color, find its token; if none fits, it stays neutral.",
  "Never color alone: a word, an icon or a shape says the same, so a soft mark loses no meaning.",
  "Soft in the regular theme; the more-contrast modes make every color strict. Neutral text is AA everywhere.",
  "A tint belongs on something whose color is its meaning (a checked answer, a plan diff's line, a subject's label), never on a button, a section or a heading.",
  "Mix in sRGB (`color-mix(in srgb, …)` or `/15` opacity): mixing in oklch against a see-through black pulls hues toward red.",
  "Navigation stays neutral, and so do the sidebar's icons; kinds' hues live in content.",
];
