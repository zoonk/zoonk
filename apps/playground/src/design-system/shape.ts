/** The values live in `packages/ui/src/styles/globals.css` and Tailwind's scale. */

export type ShapeRule = { className: string; name: string; use: string };

export const RADII: readonly ShapeRule[] = [
  { className: "rounded-xs", name: "Cell", use: "Progress cells, a calendar's days, small marks." },
  { className: "rounded-meter", name: "Meter", use: "Meters and their parts." },
  {
    className: "rounded-sm",
    name: "Inner",
    use: "What sits inside a control: a keycap, a checkbox, a goal mark, a link's focus ring.",
  },
  { className: "rounded-md", name: "Chip", use: "Chips, the subject label, small buttons." },
  { className: "rounded-lg", name: "Button", use: "Buttons, inputs and a highlighted row." },
  {
    className: "rounded-xl",
    name: "Container",
    use: "Answer options, tiles, panels, cards, menus.",
  },
  {
    className: "rounded-2xl",
    name: "Sheet",
    use: "The question sheet on a public page, a dialog.",
  },
];

export const MEASURES: readonly ShapeRule[] = [
  {
    className: "max-w-column",
    name: "Column",
    use: "A task's column, prose, a page's supporting line (40rem).",
  },
  { className: "max-w-form", name: "Form", use: "Settings forms, Plus, the buddy's chat (45rem)." },
  { className: "max-w-wide", name: "Wide", use: "A public page's widest sections (84rem)." },
];

export const SHAPE_RULES: readonly string[] = [
  "Space between blocks is a multiple of 4px; 2px steps (2, 6, 10) belong inside a control. Rows are 44 to 56px tall; everything tappable takes 44px to press (`hit-area`).",
  "Content is flat: no shadows. A panel reads by its tone and one hairline; only overlays (menus, the palette, sheets) cast one soft shadow.",
  "Meters are 6px in the app and 8px on public pages, parts 2px apart with 3px corners (`MeterParts`); a task header's segments are 4px.",
  "Public bands keep 96px above and below on a laptop and 48px on a phone; an app page has no bands.",
  "Nothing is a pill except avatars, dots and rings.",
];

export const ICON_RULES: readonly string[] = [
  "Lucide, in five sizes: 16px (`size-4`) beside text, 14px (`size-3.5`) as a list's mark, 20px (`size-5`) alone in a bar's button or beside 18px text, 24px (`size-6`) as an empty state's or a notice's one mark, 12px (`size-3`) inside a 24px control.",
  "The stroke is Lucide's own; only a glyph of 12px or less may be thickened.",
  "Navigation, meta and plan-line icons are neutral (`muted-foreground`); the current item takes the text color.",
  "A kind's icon in its hue only where kinds sit side by side (`KindMark`); done is one blue check (`DoneMark`); no icon tiles, tinted or gray: an icon sits bare beside its words, in a row, an empty state or an error page.",
  "An icon beside words is decorative (`aria-hidden`); an icon alone has a name.",
];
