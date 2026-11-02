/** The sizes live in `packages/ui/src/styles/globals.css` (`@utility text-*`) and Tailwind's scale. */

export type TypeRole = {
  className?: string;
  component?: "PageSectionTitle";
  name: string;
  sample: string;
  use: string;
};

export const TYPE_ROLES: readonly TypeRole[] = [
  {
    className: "text-display",
    name: "Display",
    sample: "Learn anything, at your level",
    use: "The landing's one promise. 40px on a phone, 64px from `sm`.",
  },
  {
    className: "text-headline",
    name: "Headline",
    sample: "Quantum physics from scratch",
    use: "A course's, chapter's or lesson's name on its public page. 34px, 48px from `sm`.",
  },
  {
    className: "text-title",
    name: "Title",
    sample: "Today",
    use: "An app page's or a task's title (`PageTitle`, `DetailTitle`).",
  },
  {
    className: "text-section",
    name: "Section",
    sample: "Example plan",
    use: "A public page's part, a real title in sentence case with a mono detail beside it.",
  },
  {
    component: "PageSectionTitle",
    name: "Section in the app",
    sample: "This week",
    use: "An app page's block (`PageSectionTitle`): sentence case, the body's size, firmer.",
  },
  {
    className: "text-lead",
    name: "Lead",
    sample: "From the math physics uses to the atom, one short lesson at a time.",
    use: "A public page's promise under its name, in the muted step.",
  },
  {
    className: "text-sm",
    name: "Body",
    sample: "Lessons, reviews and practice in the order that fits your week.",
    use: "Running text in the app (14px); public pages use 15px.",
  },
  {
    className: "text-label",
    name: "Label",
    sample: "Try a lesson · free",
    use: "Uppercase, only inside a panel (a stat tile, a sheet). A page's parts get titles.",
  },
  {
    className: "text-readout text-[2.5rem]",
    name: "Readout",
    sample: "43",
    use: "One big number per block (`BigQuantity`), tabular, its unit small and muted. 40px in the app, 56px on public pages.",
  },
  {
    className: "font-mono text-xs tabular-nums",
    name: "Mono",
    sample: "MON, OCT 26 · 3 lessons · 11 min",
    use: "Data that lines up: minutes, counts, dates, eyebrows, a row's trailing value.",
  },
];

export const TYPE_RULES: readonly string[] = [
  "Geist for words, Geist Mono for data (`font-sans`, `font-mono`); no other family. Writing and quoting are words too: an essay's box, a typed answer and a quoted source are Geist, never a serif.",
  "The one exception is a formula: KaTeX's MathML keeps a math face, a serif, because math has its own conventions (italic variables, upright operators, fractions, stretchy brackets) that Geist can't set. Numbers in a sentence stay in the sentence's face; only real formulas take it.",
  "Readouts are Geist with tabular figures; Geist Mono stays for standalone data in rows, eyebrows and facts lines. A number inside a sentence stays in the sentence's face.",
  "Three levels of type in a block at most: the main thing, its supporting line, its meta.",
  "Titles, not labels: a page's parts are named by sentence-case titles; uppercase labels live only inside panels.",
];
