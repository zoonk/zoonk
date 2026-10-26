/**
 * Spacing, radius, measures, elevation and icons: what each is for. The values live in
 * `packages/ui/src/styles/globals.css` and Tailwind's scale.
 */

/** A named value and what it's for, by its class. */
export type ShapeRule = { className: string; name: string; use: string };

export const RADII: readonly ShapeRule[] = [
  { className: "rounded-md", name: "Chip", use: "Chips, the subject label, small buttons." },
  { className: "rounded-lg", name: "Button", use: "Buttons and inputs." },
  { className: "rounded-option", name: "Option", use: "Answer options and stat tiles." },
  { className: "rounded-xl", name: "Panel", use: "Panels, cards, menus." },
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
  "A 4px grid. Rows are 44 to 56px tall; everything tappable takes 44px to press (`hit-area`).",
  "Content is flat: no shadows. A panel reads by its tone and one hairline; only overlays (menus, the palette, sheets) cast one soft shadow.",
  "Meters are 6px in the app and 8px on public pages, parts 2px apart with 3px corners (`MeterParts`); a task header's segments are 4px.",
  "Public bands keep 96px above and below on a laptop and 48px on a phone; an app page has no bands.",
  "Nothing is a pill except avatars, dots and rings.",
];

export const ICON_RULES: readonly string[] = [
  "Lucide, 16px (`size-4`) beside 14px text, 14px (`size-3.5`) as a list's mark.",
  "Navigation, meta and plan-line icons are neutral (`muted-foreground`); the current item takes the text color.",
  "A kind's icon in its hue only where kinds sit side by side (`KindMark`); done is one blue check (`DoneMark`); no tinted icon tiles.",
  "An icon beside words is decorative (`aria-hidden`); an icon alone has a name.",
];
