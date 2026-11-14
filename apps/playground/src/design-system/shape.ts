/** The values live in `packages/ui/src/styles/globals.css` and Tailwind's scale. */

export type ShapeRule = { className: string; name: string; use: string };

export const RADII: readonly ShapeRule[] = [
  { className: "rounded-xs", name: "Cell", use: "Progress cells, a calendar's days, small marks." },
  { className: "rounded-meter", name: "Meter", use: "Meters and their parts." },
  {
    className: "rounded-sm",
    name: "Inner",
    use: "Chips and what sits inside a control: a keycap, a checkbox, a goal mark, a link's focus ring.",
  },
  { className: "rounded-md", name: "Small button", use: "Buttons of 30px and under, tabs." },
  { className: "rounded-lg", name: "Button", use: "Buttons, inputs and a highlighted row." },
  {
    className: "rounded-xl",
    name: "Container",
    use: "Answer options, tiles, panels, cards, menus.",
  },
  {
    className: "rounded-2xl",
    name: "Sheet",
    use: "Sheets and dialogs, the question sheet on a public page.",
  },
];

export const EDGE_RULES: readonly string[] = [
  "A column has one start edge and one end edge. Titles, text, rows and outlined controls line up on them by their box.",
  "A control with no outline lines up by what you see: `Button`'s `edge` (`start` or `end`) moves it out by the blank between its box and its glyph, so the glyph lines up with the letters on that edge, no part of it passes the edge, and the hover box hangs past it. No screen writes a margin for it.",
  "A bare chevron at a row's or a fold's end takes the same utility (`edge -me-(--edge-pull)`), as `RowChevron` and `FoldChevron` do. A bare mark that starts a column takes `edge -ms-(--edge-start)`.",
  "A highlighted or hovered row and the current tab's fill reach 10px past the column on both sides, so their words stay on the edge.",
  "A panel's line is inside its box (`ring-inset`), so a card is exactly as wide as its column.",
];

export type ControlSize = {
  height: string;
  iconSize?: "icon-xs" | "icon-sm" | "icon";
  size: "xs" | "sm" | "default" | "lg";
  use: string;
};

export const CONTROL_SIZES: readonly ControlSize[] = [
  { height: "44px", size: "lg", use: "A screen's action, a bar's buttons and every input." },
  { height: "36px", iconSize: "icon", size: "default", use: "A button on a page or in a panel." },
  {
    height: "30px",
    iconSize: "icon-sm",
    size: "sm",
    use: "Beside text: a section's action, a tab, a page's “…” alone beside its title.",
  },
  { height: "24px", iconSize: "icon-xs", size: "xs", use: "Inside another control." },
];

export const CONTROL_RULES: readonly string[] = [
  "Controls on one row share one height, and an icon button is as tall as the button beside it (`icon-sm` beside `sm`). A chip is 22px.",
  "A filled and an outlined button of one size draw at the same size.",
  "A bar's buttons are 8px apart, and the bar pads 12px above and below them. With a main and a second action, both are one height; a third is a quiet option in the column.",
  "A top bar's button is 44px on a phone and 40px from `lg` (`bar`, `icon-bar`).",
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
  "Each button height has one label size: 44px with 15px (`lg`), 36px with 14px, 30px with 13px (`sm`), 24px with 12px (`xs`). No call site sets a button's height or its label's size.",
  "Nothing is a pill except avatars, dots and rings.",
];

export type IconSize = { className: string; size: string; use: string };

export const ICON_SIZES: readonly IconSize[] = [
  { className: "size-3", size: "12px", use: "Inside a 24px control." },
  { className: "size-3.5", size: "14px", use: "A list's mark." },
  {
    className: "size-4",
    size: "16px",
    use: "Beside text, and inside an outlined or filled square button of any size.",
  },
  {
    className: "size-5",
    size: "20px",
    use: "Alone in a bar's button that has no outline, or beside 18px text.",
  },
  { className: "size-6", size: "24px", use: "An empty state's or a notice's one mark." },
];

export type IconMeaning = {
  icon: "chevron-down" | "chevron-left" | "chevron-right" | "ellipsis" | "x";
  meaning: string;
};

export const ICON_MEANINGS: readonly IconMeaning[] = [
  { icon: "chevron-left", meaning: "Back, before the name of the page it goes back to" },
  { icon: "x", meaning: "Close" },
  { icon: "ellipsis", meaning: "More" },
  { icon: "chevron-right", meaning: "Forward: a row that opens a page, or after a button's label" },
  { icon: "chevron-down", meaning: "A row that folds" },
];

export const ICON_RULES: readonly string[] = [
  "Lucide, in five sizes: 16px (`size-4`) beside text, 14px (`size-3.5`) as a list's mark, 20px (`size-5`) alone in a bar's button that has no outline or beside 18px text, 16px inside an outlined or filled square button, 24px (`size-6`) as an empty state's or a notice's one mark, 12px (`size-3`) inside a 24px control.",
  "The stroke is Lucide's own; only a glyph of 12px or less may be thickened.",
  "One thing, one icon: the way back is `chevron-left` and the name of the page it goes back to (`BackLink`), close is `x`, more is `ellipsis`. No button holds an arrow: a forward glyph is `chevron-right` after the label (`FORWARD_ICON`), the same glyph that ends a row that opens a page.",
  "Navigation, meta and plan-line icons are neutral (`muted-foreground`); the current item takes the text color.",
  "A kind's icon in its hue only where kinds sit side by side (`KindMark`); done is one blue check (`DoneMark`); no icon tiles, tinted or gray: an icon sits bare beside its words, in a row, an empty state or an error page.",
  "An icon beside words is decorative (`aria-hidden`); an icon alone has a name.",
];
