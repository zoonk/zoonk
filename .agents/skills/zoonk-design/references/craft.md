# Craft

How a Zoonk screen is drawn, as rules with a number. The [taste bar](../SKILL.md#the-taste-bar) has the short form; this file has each rule, how to check it and how it usually gets broken. Rule ids (E1, H4…) are stable: findings and measured leads name them.

The design system is the reference. A fault is one of two kinds:

- **The screen departs from the system.** Fix the screen, or the shared piece when the fault is the piece's, so every screen gets the fix.
- **The system departs from a rule here.** Report it once, against the token or component, never once per screen. Changing a token or a shared piece's look is the user's decision.

The [deliberate choices](#deliberate-choices) at the end are neither.

## Terms

- **Column.** The box content lines up in: a page's column (`Page`), a task's (`max-w-column`), an aside, a sheet's or a panel's content box. Its **start edge** is that box's left (right in right-to-left), its **end edge** the other side.
- **Ink.** What is drawn, not its box: a line of text from its first glyph to its last, an icon's shape inside its canvas. A Lucide glyph starts inside its box by about a third of the icon's width for a chevron, a fifth for ✕ and an eighth for an ellipsis. Letters start inside their box too: in Geist an "S" by 0.053 of the text's size (1.6px in a 30px title), a stem ("P") by 0.08, a diagonal ("A") by 0.02, and they end about 0.04 short of it.
- **Visible box.** The shape the eye sees as a control: its border or ring when it has one, otherwise its fill. Never its 44px hit area.
- **Bezel.** A visible fill or border around a control. A ghost button at rest has none.
- **Within.** 1px for text and boxes. A glyph's ink never passes its column's edge, by any part of a pixel; beside text it sits with that text's letters, at most 1px past them toward the edge and 2px short of them (one pull serves every first letter). Check at 390 and 1440, at rest, and a glyph's edge in the pixels of 1x, 2x and 3x screens. The numbers are the web's; [iOS and Android](../SKILL.md#ios-and-android) says what holds there.

## Edges and alignment

### E1. One start edge per column

In a column, every block starts on the column's start edge or on the one inner edge where row text starts after a leading mark (28px in `ListRow`: a 16px mark and a 12px gap). A panel's content starts at the panel's padding.

- **Check.** Hold a ruler down the left side and count where text and boxes begin: the edge, the text-after-mark edge and one indent at most. In the page, each block's ink left minus the column's start edge is 0, 28 or the panel's padding.
- **Usual break.** One row with a leading icon among rows without one. A chart or calendar with its own inner padding. An icon whose gap to its text differs from the rows above it.

### E2. A bare glyph sits on the edge by its ink

An icon button with no bezel that is the first or last thing in a bar, a header or a row lines up by its glyph's ink, and the eye compares ink with ink: the arrow with the first letter of the title under it, a row's chevron with the hairline it ends. Two things hold:

- **Nothing of the glyph crosses the edge.** No pixel of the arrow, the "…", the ✕ or a chevron, anti-aliased ones included, lies outside the column's edge on its side.
- **Where text is on that edge, the glyph sits with its letters.** Letters start inside their box, so a glyph that starts a column stops short of the box by 0.053 of the size of the text under it: with a title's "S", a hair outside a stem, a little inside a diagonal. Where only hairlines and boxes are on the edge, as at a row's end, the box is the line.

A control with a bezel lines up by its bezel. A bare one takes `Button`'s `edge` (`start` or `end`; `buttonVariants({ edge })` on a link, `edge -me-(--edge-pull)` or `edge -ms-(--edge-start)` on a bare icon), which pulls it out by its padding and its glyph's blank side in whole pixels, never a margin of its own. Its hit area stays 44px.

- **Check.** Enlarge the corner: does the back arrow start in the same column of pixels as the title's first letter, and does the "…" or chevron end on the hairline's end without passing it? In numbers: no ink outside the edge; the glyph within 1px past the letters and 2px short of them, or within 1px short of a box.
- **Usual break.** A 44px ghost icon button dropped at the start of a bar: its padding moves a 20px chevron 12px in and the chevron's blank side adds 7. Lining the glyph up with the text's box, which leaves the arrow 1.6px left of the "S" under it. A pull that isn't a whole pixel, which the browser snaps so the glyph lands a third of a pixel outside.

### E3. One end edge

Trailing things end on the column's end edge: a header's detail, a row's value or chevron, a button's bezel, a meter. In one list, rows with and without a chevron end their values on one edge, and so do values and glyphs at a row's end: a row without a chevron keeps the chevron's room.

- **Check.** Ruler down the right side: details, values, chevrons and buttons end on one line (glyph ink within 2px), and in a list every row's value ends where the others' do.
- **Usual break.** A chevron whose box is flush and whose ink stops 5px short, under a detail that ends on the edge. A date that runs to the edge on the one row with nothing to open.

### E4. One axis for marks, one edge for labels

In a list, a menu or the sidebar, every leading mark (icon, avatar, dot, goal mark, logo) is centered on one vertical line and every label starts on one edge.

- **Check.** Marks' horizontal centers within 1px of each other; labels' ink lefts within 1px.
- **Usual break.** Marks of three sizes each given the same gap, so their labels start in three places.

### E5. An icon and its text share a line

An icon beside one line of text is centered on that line. Beside a title with one description line it is centered on the row, as `ListRowIcon` draws it, level with the row's trailing value and chevron. Beside three or more lines it sits on the first.

- **Check.** Icon center to the line's center: 1px or less. One choice per list.
- **Usual break.** `items-center` on a wrapper whose text wraps to four lines in a narrow aside.

### E6. Shared baselines, tops and bottoms

Texts of different sizes on one row share a baseline (a readout and its unit, a title and its count). A control and the text beside it share a center line. Siblings of one kind side by side (tiles, cards, buttons) share a top and a bottom. A row is aligned one way: when its text and controls are centered, its picture is too.

- **Check.** Baselines within 1px; centers within 1px; siblings' visible boxes equal in top and height.
- **Usual break.** `items-center` where `items-baseline` was needed. A character's picture on the row's bottom beside centered text.

### E7. Bleeds are declared, equal and symmetric

Only three things pass the column: a highlighted or hovered row (10px each side, `LIST_ROW_CLASS`), a bar's or a section's hairline, and a full-bleed picture. A bleed is the same on both sides.

- **Check.** Anything wider than its column: left bleed equals right bleed, and it is one of the three.
- **Usual break.** A tinted band with a negative margin on one side only.

### E8. One page top

A page's title is close to the top and at the same y on every page, on a phone and a computer: 12px, the 44px bar with the way back and the page's actions, its hairline, then 12px to the title (`PageTop`, or `PageTopBar` in a layout and `PAGE_HEADER_CLASS` in the page). The bar keeps its room when it holds nothing, the frame has no top padding, no page pads or pushes its own title, and nothing sits over it ([titles at one height](app-patterns.md#what-every-page-shares)). The way back is `BackLink` (I4), always with the page's name. A task keeps its own header with ✕. A [marketing page](../SKILL.md#marketing-pages), the blog and the design site are outside this rule: each keeps its site's header, with its titles at one height from one layout piece and a first screen's room set once per kind of page.

- **Check.** The `h1`'s top per page and screen size: 69px from the frame's top, equal within 1px. `verify:pages` leads to a title with more than 4px more room over it on a phone than on a laptop and to a back link with no name; `zoonk/no-page-top-spacing` and `zoonk/one-back-link` hold the source.
- **Usual break.** `pt-5` on a header, top padding on the frame, or a bar hidden on a computer, so one page's title sits higher or lower. A second header component that decides the title's place again.

### E9. Start-aligned or centered, never both

A column is start-aligned. Centering is for a screen built that way (login, a ceremony, a wait), a title over a task's centered column, and a caption directly under a full-width button.

- **Check.** In a start-aligned column, a block narrower than the column with equal space on both sides is a finding.
- **Usual break.** A quiet action centered under left-aligned answer options.

## Spacing and rhythm

### S1. Gaps come from the scale

Space between blocks, and a container's padding, is a multiple of 4px: 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 96. Inside one control (icon to label, a chip's padding) 2, 6 and 10 are also used.

- **Check.** Gaps between sibling blocks and each container's paddings are in the set.
- **Usual break.** A one-off margin to make one screen "look right".

### S2. The same things sit the same distance apart

In a list, grid or stack of one kind, every gap is equal, and the same kind of pair has the same gap on every screen (`Page`'s sections 28px, tiles 8px, a bar's buttons 8px).

- **Check.** Gaps between consecutive siblings of one component differ by 1px at most.
- **Usual break.** A margin on one child of a stack that already has a gap.

### S3. Closer means related

A title is closer to what it names than to what precedes it: the space above a section title is at least 1.5 times the space below it. A label is closer to its control than to the previous one.

- **Check.** Cover the words: the groups still read as groups from the space alone.
- **Usual break.** Equal space above and below every heading.

### S4. Padding is even

A box that holds content (a card, a panel, a composer, a bar) gives it the same room on all four sides. A control (a button, a chip, a field) is wider than tall, with equal left and right padding. Text is never closer than 8px to a bordered or filled edge (12px in a panel), and two containers of one kind have the same padding.

- **Check.** In a box: content ink to each of the four edges, equal within 2px (a `verify:pages` craft lead). Text ink to the nearest bordered or filled edge is 8px or more.
- **Usual break.** 16px at a card's sides and 12px over and under it. Two rails of one width with different inner padding.

### S5. The gutter is the frame's

Content keeps the frame's gutter from the screen's edge: 16px on a phone, 32px on a tablet, 40px beside the sidebar from `lg`. Only E7's bleeds pass it. A menu or a popover keeps at least 16px from the screen's edge (the pieces' collision padding).

- **Check.** The main region's leftmost and rightmost ink against the screen's edges.
- **Usual break.** A box drawn with an outside ring, 1px wider than the field above it.

## Shape

### H1. One radius per role

A corner's radius is its role's token from `RADII` (`apps/playground/src/design-system/shape.ts`), never a literal: cells and small marks `rounded-xs` (2px), meters `rounded-meter` (3px), chips and what sits inside a control (a keycap, a checkbox, a goal mark) `rounded-sm` (6px), small buttons and tabs `rounded-md` (8px), buttons, inputs and a highlighted row `rounded-lg` (10px), every container (answer options, tiles, panels, cards, menus) `rounded-xl` (14px), sheets and dialogs `rounded-2xl` (18px), full for avatars, dots, rings and a switch.

- **Check.** Boxes with the same job on one screen have the same corners; every radius is a token's value.
- **Usual break.** `rounded-[0.625rem]`; two kinds of container 2px apart.

### H2. Nested corners are concentric

A rounded box inside a rounded box takes the outer radius minus the gap between them, and is never rounder than the outer one.

- **Check.** The band between an inner and an outer corner keeps one width around the curve. Inner radius within 2px of outer minus gap, when the gap is smaller than the outer radius.
- **Usual break.** One radius token on a card and on the button 6px inside it.

### H3. No pills, no mixed shapes

Nothing is a pill except avatars, dots, rings and a switch, and a screen never mixes square, rounded and pill controls.

- **Check.** No control wider than tall with a radius of half its height; no square-cornered control beside rounded ones.
- **Usual break.** `rounded-full` on a chip or a badge.

### H4. A control's visible box is its box

Two controls of one size look one size: a filled and an outline button side by side have the same visible height, edges and corner.

- **Check.** Visible boxes of sibling controls: equal heights and tops in a row, equal lefts and rights in a stack, within 0.5px.
- **Usual break.** A fill clipped inside a transparent border (`bg-clip-padding`), 1px smaller all round than the outline beside it.

### H5. One line weight, no shadows on content

Borders and dividers are 1px. A 2px line means a pick or focus. Content casts no shadow; only overlays do.

- **Check.** No heavier divider or border; no shadow outside a menu, a sheet, a dialog or the palette.
- **Usual break.** A selected chip with a 1px dark border beside picks with a 2px ring.

## Control sizes

### Z1. Heights from the set, one height per row

A control's height is one of `Button`'s, and each height has one label size: 44px for a screen's action (`lg`) and for inputs, with a 15px label; 36px by default, 14px; 30px beside text (`sm`), 13px; 24px inside another control (`xs`), 12px. No call site sets a button's height, label size or weight. A top bar's button is 44px and 40px from `lg` (a 14px label there); a bottom bar's buttons are 44px at every width; chips are 22px. Controls on one row share one height, and an icon button is as tall as the button beside it (`icon-sm` beside `sm`, 30px). A page's "…" is as tall as the action beside it, and 30px alone beside the title (`DetailMenu`).

- **Check.** In any row of controls, visible heights are equal within 0.5px, and each is in the set.
- **Usual break.** A 44px select beside 36px buttons in a toolbar.

### Z2. The same control is the same size everywhere

A page's "…", its way back, a sheet's close and a list's row are one size and one style on every page of a kind.

- **Check.** Compare this screen's back, close and "…" with its sibling pages'.
- **Usual break.** The page menu as a 30px square on one page and a 44px one on the next.

### Z3. Targets are 44px and don't overlap

Everything tappable takes 44 by 44px to press ([44px targets](app-patterns.md#what-every-page-shares)), and two press areas never overlap.

- **Check.** Small controls side by side: their `hit-area`s don't intersect.
- **Usual break.** Two 30px buttons 8px apart.

### Z4. Two actions in a bar

In the bottom bar (`BottomBar`, its row `BottomBarActions`; [R2](#r2-the-main-action-is-in-the-bottom-bar)) with a main and a second action, both are one height, 8px apart, and on a phone the main one fills what the second leaves. The buttons have the same room over and under them as at their sides, the frame's gutter: 16px on a phone, 24px in a task on a computer, 32px in the app's shell from `sm`. A third action is a quiet option in the column, not a third style in the bar. What the last action couldn't do shows over the screen above the bar (`note`), so the bar never grows and its buttons never move.

- **Check.** Equal visible heights; the bar's one gap; two button styles at most; the bar's height and its buttons' places the same with and without an error line.
- **Usual break.** An outline, a filled and a gray button in one bar. An error line as a second row in the bar.

## Type

### T1. Sizes come from the roles

Every font size is a type role's (`TYPE_ROLES`, `apps/playground/src/design-system/type.ts`): 11.5px `text-2xs`, 12px `text-xs`, 13px `text-compact`, 14px `text-sm`, 15px `text-reading`, then 16, 18, 20, 24 and 30px from Tailwind's scale, and the sizes the title, headline, display, lead and readout roles set for themselves. No code writes a size (`text-[…]`) except a readout's 40 and 56px. A sheet's, a dialog's and a side sheet's title is 18px semibold, set by the piece, never by its caller. A block uses three sizes at most: the main thing, its supporting line, its meta.

- **Check.** List the sizes in each block: four or more is a finding, and so is a size no role or shared piece has.
- **Usual break.** `text-[1.1875rem]` for one heading; 13.5px beside 13px.

### T2. Steps you can see

Two texts with different jobs differ by size (at least 1.15 times), by weight or by tone. Two semibold sizes closer than that never share a screen.

- **Check.** Squint: can you rank the screen's titles without reading them?
- **Usual break.** Semibold headings at 16, 17, 18 and 20px on one page.

### T3. Two families, three weights

Geist for words, Geist Mono for data, a math face only in a formula. Weights are 400 (`font-normal`), 500 (`font-medium`) and 600 (`font-semibold`), by name: no code writes a weight as a number, and the type roles set 600 for a title and 500 for a label. A button's label is 500 at every size, filled or not; the fill is what makes the main action lead. Nothing under 11px.

- **Check.** No serif or system font, in frames and emails too; nothing bold or light.
- **Usual break.** HTML in a frame or an email with no font set, drawn in the browser's serif. `font-[560]` on one button to make it "a little firmer".

### T4. Numbers line up

Numbers that are compared are Geist Mono with tabular figures and end on one edge.

- **Check.** A column's values end together (ink rights within 1px) and line up digit under digit. A sentence in mono is a finding.
- **Usual break.** A percentage column in the text face, ragged on the right.

### T5. A measure you can read

Running text is 45 to 90 characters a line and never wider than `max-w-column`. Body line height is 1.4 to 1.6 of its size, a title's 1.05 to 1.25.

- **Check.** No paragraph runs the width of a laptop.
- **Usual break.** A description that fills a 1,100px page.

### T6. Titles, not labels

A page's parts are named by sentence-case titles. Uppercase is the label role inside a panel or a sheet.

- **Check.** No section of the page is headed by small capitals.
- **Usual break.** An uppercase label heading one section among sentence-case titles.

## Icons

### I1. One family

Every interface icon on the web is Lucide. Characters, flags, the logo, brand marks on the login page and drawn charts are pictures.

- **Check.** No icon drawn by another hand: filled among lines, sharper corners, another angle.
- **Usual break.** A pasted SVG path for one missing glyph.

### I2. Sizes matched to the text

Five sizes (`ICON_RULES`): 16px beside text, 14px as a list's mark, 20px alone in a bar's button that has no outline or beside 18px text, 24px as an empty state's or a notice's one mark, 12px inside a 24px control. A glyph inside an outlined or filled square button is 16px at every button size. No other size, and icons side by side are one size.

- **Check.** No icon larger than 1.3 times its text's size; one size per row of icons.
- **Usual break.** `size-4.5` or `size-[18px]`: an icon scaled to fill a gap.

### I3. One weight

Lucide's stroke is 2 on its 24-unit canvas, so the line thins and thickens with the icon. Never override it, except to thicken a glyph of 12px or less, and never draw an icon larger than 24px.

- **Check.** No icon bolder or thinner than its neighbors.
- **Usual break.** `strokeWidth={1.5}` to make one icon "lighter".

### I4. One thing, one icon

The way back from a page is `chevron-left` and the name of the page it goes back to (`BackLink`), the mirror of a "See all" row's words and `chevron-right`, so both keep one gap; a task's previous step is the bare chevron. Close is `x`, more `ellipsis`. No button holds an arrow: a forward glyph is `chevron-right` after the label (`FORWARD_ICON`), on the label's center line. A row that opens a page ends in `chevron-right`, one that folds in `chevron-down`. A kind's icon comes from `KIND_MARKS`.

- **Check.** This screen's back, close and more are drawn as the last screen drew them.
- **Usual break.** An arrow in a button or for the way back. A back chevron with no name.

### I5. One gap to the text

An icon and its label are one gap apart per component (`Button`'s own gap; 12px after a row's leading mark).

- **Check.** No icon tighter to its word than the icons above it.
- **Usual break.** `gap-1.5` on a hand-built row among `ListRow`s.

### I6. One glyph on a button

A button shows its label and at most one glyph: an icon, a forward chevron or a keycap, never two. The main action that Enter presses (`EnterButton`, and the pieces built on it) has the ⏎ keycap as its glyph where there is a keyboard and is its label alone on a touch screen, so it takes no icon. While a button works, the spinner takes its glyph's place, or covers its label when it shows none, and nothing changes size.

- **Check.** Count the glyphs in each button: one at most (`zoonk/one-glyph-button`). The button's width at rest and busy: equal.
- **Usual break.** A forward arrow and ⏎ on "Start". A play or check icon beside the ⏎ keycap, added so the spinner has a place to go.

## Density and balance

### D1. Rows of one kind are one height

Rows with the same number of text lines have the same height: at least 44px for one line, a title and a line a step taller.

- **Check.** Sibling rows with equal line counts: heights within 1px.
- **Usual break.** Two tables in one aside with different row heights.

### D2. Lines run their full length

A hairline spans what it divides, from the list's start edge to its end edge, and every hairline in a list is the same length.

- **Check.** No divider stops short; the last one doesn't end under the second card.
- **Usual break.** A border on grid cells, so an incomplete last row draws a short line.

### D3. Nothing stranded, nothing empty

No rail, aside or panel is drawn with nothing in it.

- **Check.** A bordered or divided area with no text or picture is a finding.
- **Usual break.** A task's aside rendered for a screen with nothing to put in it.

### D4. One strongest thing

One filled button in view, outside a dialog. Around it, buttons step down: outline, then ghost.

- **Check.** Count the filled buttons on the screen.
- **Usual break.** A second primary for a secondary action.

## States

### X1. Every control has every state

A control has a rest, hover, pressed, keyboard-focus, disabled and busy look. A control that is acting is busy (a spinner in its icon's place, a second press blocked), never only disabled. Hover and pressed have more contrast than rest. Focus is a ring at least 2px thick with 3:1 contrast against what's around it, never clipped. What tells a control's shape or state apart from the page (an off switch's track, an empty radio's or checkbox's ring, a field's or a code box's outline (`border-field`), a slider's thumb, a white belt's outline, a sheet's handle, a keycap's mark, a row's chevron) has 3:1 contrast too. An outline button keeps the light line (`border-input`): its words say what it is.

- **Check.** In a focus screenshot the focused control is found at a glance; a disabled one reads as off, not broken.
- **Usual break.** A hand-built clickable `div` with a hover fill and no focus ring.

### X2. A state is drawn one way

A pick is a 2px ring in the text color on its tint (`ChoiceList`, `AnswerOption`). The current item in navigation is the `muted` fill. The current tab has one look in every app, the navigation's `muted` fill (`TAB_CLASS`).

- **Check.** No two kinds of "selected" on one screen drawn differently.
- **Usual break.** A toggle chip "on" with a 1px border beside radio cards "on" with a 2px ring.

### X3. A state change moves nothing

Hover, focus, selected, busy and disabled never change a control's size or shift its neighbors.

A screen that changes height or moves a neighbor when data, a picture or a font arrives after the first paint breaks it too.

- **Check.** Between two state screenshots nothing else moves. `verify:pages` measures it on the phone and the laptop: it types in each field, picks each choice, opens and closes each fold, tab, menu and dialog, hovers and presses each control, and leads to anything that moved or a control that changed size, with the pixels (it blocks every save, so a pick that saves shows what a failed save shows, and the lead says so); it also leads to any layout shift while the page loads. States it can't reach without submitting (saving, a check that calls the server, a busy button, a lesson's result) stay with the craft read: put their screenshots side by side.
- **Usual break.** A heavier weight or a thicker border on the selected item. A hint that appears and pushes the form down. A spinner larger than the icon it replaces. A picture with no reserved size.

## Behavior

What a control does when it's pressed, by key, click or tap, is part of how it's drawn: the same piece does the same thing on every screen. Each key the product answers is in one list in the kit (`SHORTCUTS`), which the handlers, the keycaps and what screen readers are told all read, and the piece that draws a control carries its key. In the app, `?` opens the list (the palette finds it as "Keyboard shortcuts"); the design site's Keyboard page shows it too.

### B1. The same control answers the same keys everywhere

A sidebar's toggle, a task's ✕, a page's way back, a main action, a question's options, a "…" and a panel's close each do the same thing, by key and by click, on every screen that has one: ⌘B (Ctrl+B) collapses whichever sidebar is on screen, Esc presses a task's ✕, Enter presses the main action, ↑ and ↓ move between the options of a pick-one control.

- **Check.** Name this screen's controls that exist on another screen. Press each one's key here and there: the same thing happens.
- **Usual break.** A second copy of the control drawn without the piece that carries its key: a task's own sidebar toggle without ⌘B, a main button from `buttonVariants` that Enter doesn't press, a key bound in a screen's own file.

### B2. Every shortcut shows its keycap

On a device with a keyboard, a control that answers a key shows it: in the control, or in its tooltip when it's an icon button. The keycap's key does what a click does, and screen readers are told it (`aria-keyshortcuts`). Number keys answer a screen's one list of choices: its first nine rows show 1 to 9, and a number picks its row (a pick-one list) or ticks and unticks it (a pick-many list). A screen with several lists shows none, since nothing says which list 1 belongs to. A match is the exception, because its two columns are one answer: the numbers run once across both columns, the left one first (1 to 3, then 4 to 6), so a number never shows twice and the first nine entries answer a key; an entry already in a pair shows its left entry's number in its key's box and answers no key.

- **Check.** For each keycap on screen, press its key: the same thing happens as on a click. For each key the screen answers, find its keycap.
- **Usual break.** Enter bound and no ⏎ drawn. A number key bound on rows that draw no number. A keycap or an `aria-keyshortcuts` typed by hand, which drifts from the handler.

### B3. A key presses only what is on screen

No key acts through a control the learner can't see. Where a back link is drawn only on a phone, Esc goes back only on a phone.

- **Check.** With nothing focused and nothing open, press Esc and Enter. If the screen changes, point at the control that did it.
- **Usual break.** A back link hidden on a laptop that still answers Esc.

### B4. A panel closes three ways

A dialog, a sheet or a side panel closes with Esc, with a press outside it, and with a control you can see: its ✕ beside its title, one size in every panel. A sheet on a phone also closes with a swipe down. Only a question that needs an answer (delete, hand in, leave with a loss) ignores a press outside and a swipe and has no ✕: its answers are its ways out, and Esc cancels.

What opens decides its panel, and the screen's size decides its place. On a phone everything that opens over a page rises from the bottom: a short form, a pick or a detail as a sheet with a grab handle (`Drawer`), and a question that needs an answer as a sheet without one, the confirm on top and "Cancel" under it (`AlertDialog`). On a computer both are centered. The piece decides, so no screen picks a dialog or a sheet itself. A side panel (`SidePanel`) is a computer's, only for something edited beside the page it changes (a sheet on a phone). A menu or a popover, for a few choices or one fact tied to a control, stays anchored to it at every size. A bottom-docked box is a phone's shape (where the thumb is, closed with a swipe); on a computer the eyes and pointer are in the middle of the window.

- **Check.** Open it and close it each way. On a computer, find its ✕ without looking for a grab handle. On a phone, its bottom edge is the screen's. The `verify:pages` walk opens each one and checks its place, its focus and its closes; `zoonk/one-overlay-piece` holds the source.
- **Usual break.** A sheet with a grab handle and no ✕, docked at the bottom of a computer's window. A dialog still centered on a phone.

### B5. Focus goes in, and comes back

A panel opens with focus on its first field, or on itself when it has none, and closes with focus back on what opened it. A task's "…" is the one exception: when it closes, focus goes back into the task (its main action when it can be pressed, otherwise its body), so Enter goes on with the task and doesn't reopen the menu.

- **Check.** After opening, Tab stays inside the panel. After closing, the focused element is the trigger.
- **Usual break.** Focus left on the page behind a dialog, or dropped to the top of the page on close.

### B6. Esc does what ✕ does, and neither loses work

On a task, Esc closes what is open; with nothing open, it presses ✕, so it goes where ✕ goes. Where leaving loses something (an answer not yet checked, unsent text, a running clock), ✕ and Esc both ask first, with the same question. Esc does nothing while a text field has focus.

- **Check.** Type an answer, move focus off the field, press Esc: the same question ✕ asks. With nothing to lose, Esc and ✕ land on the same page.
- **Usual break.** A switch that turns Esc off on one screen while ✕ beside it still leaves with one click; a task that asks on ✕ and leaves on Esc.

## Roles

A role is a job a screen gives one of its parts: its top, the way back, its main action, what opens over it, the line over its title, the gate before something paid. One role has one piece, one place and one wording, in every area; the [design skill's table](../SKILL.md#find-the-piece-before-you-build-one) names each piece. The top is E8's, the way back I4's, a button's glyph I6's, an overlay B4's, and the rest are below.

### R1. One role, one piece

Each role is drawn by its shared piece, with nothing added around it by the screen: no spacing, size, glyph or words of its own.

- **Check.** [The role read](#the-role-read): every instance of the role, side by side. Any that differs is a finding.
- **Usual break.** Two areas each building the piece. A screen that wraps the piece in its own padding.

### R2. The main action is in the bottom bar

An app screen's one main action sits in `BottomBar`, pinned to the bottom of the screen on a phone and a computer, where the thumb is and where Enter's hint is found. A task's record or check button is its main action and sits there too. A screen with no main action has no bar; what opens over a page keeps its own footer. On a [marketing page](../SKILL.md#marketing-pages) the one action sits in the page, and the bar shows it once the page's own has scrolled away.

- **Check.** The main action's box is inside the bar, and the bar's bottom is the screen's bottom (or the tab bar's top) before and after scrolling, at 390 and 1440. `verify:pages` leads to a lone primary button that isn't pinned in the screen's lower half or sits outside the bar.
- **Usual break.** The action under the content on one screen, beside the title on the next, at the top on a computer.

### R3. The line over a title is `Eyebrow`

When a task's, a card's, a sheet's or a question's title has a small line over it, that line is `Eyebrow` (`SuccessEyebrow` for something done): an outlined chip, a label in sentence case, 12px over its title. A page with the app's header has no line over its title; what the line said goes under the title or leaves.

- **Check.** Anything directly over a title is the chip, or nothing (`zoonk/one-eyebrow`, and a `verify:pages` lead for text over a title outside the piece).
- **Usual break.** Gray or mono uppercase text over a title in one area and a chip in the next.

### R4. A paid feature wears nothing, and gates once

A row, card, tab or button for a paid feature looks like its free neighbors: no badge, chip, lock or card that says it's paid. The subscription gate (`SubscribeGate`) shows once, in the feature's place, when the learner tries to use it. Its action reads "Subscribe".

- **Check.** `node scripts/verify/catalog-rules.mts` lists every string that pays in other words, names the plan outside pricing or offers a "none" beside Skip (`verify:diff` asks about each new one); `zoonk/no-plus-badge` holds the source; `verify:pages` leads to a second gate on one screen. Whether a gate shows before the learner asked for the feature is the reader's to judge.
- **Usual break.** A badge on the row and a notice on the page it opens. A card that announces the limit above a button that will show the gate anyway.

## The craft read

The questions of [the craft read](../SKILL.md#the-craft-read), answered for one screenshot, in this order, each with "fine" or a finding you can point at:

1. **Left edge.** How many places do text and boxes start, and where? (E1, E4)
2. **Top bar.** Does the back arrow or the close start where the title's first letter starts, and the right-hand "…" or avatar end on the content's right edge, with no part of either past the edge? (E2)
3. **Right edge.** Do details, values, chevrons and buttons end on one line? (E3)
4. **Rows.** In each list: marks on one axis, labels on one edge, icons level with their text, rows of one height, dividers of one length? (E4, E5, D1, D2)
5. **Pairs.** Things side by side: same top, same bottom, same baseline? (E6, H4)
6. **Gaps.** In each group, is any gap unlike its neighbors? Is each title nearer its own content than what's above? (S2, S3, S4)
7. **Corners.** Which radii can you tell apart, and what wears each? Any box of one job with other corners, any inner corner too round or too square, any pill? (H1, H2, H3)
8. **Control sizes.** Which heights are on the screen? Any row with two? Any control unlike the same control elsewhere? (Z1, Z2, Z4)
9. **Type.** Which sizes are in each block? More than three, or two you can barely tell apart? Any other face, any bold, any uppercase heading? (T1, T2, T3, T6)
10. **Numbers.** Do columns of numbers line up and end together? (T4)
11. **Icons.** One family, one line weight, sizes that match their text, the usual glyph for back, close, more and forward, and no button with two glyphs? (I1 to I6)
12. **Balance.** One filled button? Anything empty, centered in a start-aligned column, or bleeding on one side only? (D3, D4, E7, E9)
13. **States, if shown.** Is the selected, focused, disabled or busy thing drawn the system's way, and did anything move? (X1 to X3)
14. **Siblings, if given.** Does each piece here look and act like the same piece on the existing screen that does the same thing: words, icon, size, place, state?
15. **Roles.** Is the title close under its bar, with the page's name beside the back chevron? Is the main action in the bar at the bottom? Is anything over a title a chip? Does any row, chip or card say something is paid, or any action that leads to paying say anything but "Subscribe"? (E8, R2, R3, R4)
16. **Keys and closes, at 1440.** Does the main action wear ⏎, and does each icon button whose tooltip is shown wear its key? Does every dialog, sheet and side panel have its ✕ beside its title, one size in each? Is a short form on a computer centered, not docked at the bottom? On a phone, does everything that opens over the page sit on the bottom edge, a question that needs an answer with its two answers stacked and no ✕? (B2, B4)

A still picture can't show what a key does, where focus goes or whether Esc asks first (B1, B3, B5, B6): say so, and leave them to the walk in the running app.

Then one line: would a principal designer find anything to pick at here, and what first?

### The role read

The craft read takes one screen. The role read takes one role on every screen, because a difference between two areas is invisible to a reader who sees one. It runs when a change draws or moves a role, touches a role's piece, or was built by more than one agent, and again on the whole when the parts are combined.

1. For each role the change reaches, collect a crop of every instance, from every area and not only the changed screens, at 390 and 1440, on one sheet per role: page tops, back links, bottom bars with their main action, the overlays (open, on a phone and a computer), subscription gates, empty states, the line over a title, tabs, a list's row ends. `pnpm verify:pages --roles <every page that draws it>` makes the sheets and a table of each instance's numbers ([role sheets](../../verify/references/pages.md#compare-shared-roles)); a role it has no hook for is cropped by hand.
2. A reader that built none of them gets the sheets and this file, and nothing else. Per sheet it answers: which instances differ from the rest, in what (place, size, gap, glyph, words, what a key or a tap does), and by how much.
3. Each difference is a finding against the piece (`systemic`) or the one screen (`screen`). A difference is never deliberate unless it is in the [exceptions](#exceptions-the-user-granted).

### A finding

```json
{
  "id": "settings-phone-01",
  "picture": "settings/phone-light.png",
  "where": "top bar, left: the back chevron over the title",
  "rule": "E2",
  "what": "The chevron's ink starts at 34.7px and the title's first letter at 17.6px: 17px short of it, 2px allowed.",
  "departs": "system",
  "kind": "systemic",
  "component": "packages/learn/src/shell/learn-bar.tsx",
  "fix": "Pull the bar's back link out by its padding and the glyph's blank side, in the shared bar.",
  "confidence": "measured"
}
```

- `where`: words a person can find the place by. `what`: what is wrong, with the numbers.
- `rule`: one id from this file, or `none` with the principle it breaks, so this file can grow.
- `departs`: `system` (the screen departs from the system) or `principle` (the system departs from a rule).
- `kind`: `systemic` (a shared component or token: fix once) or `screen` (this screen's own layout). `component`: the file, when known.
- `confidence`: `measured` (numbers from the page or the pixels), `seen` (visible, not measured) or `suspected`.

## Deliberate choices

Zoonk's own, never findings on a screen. If one looks wrong, report it once as `principle`, with the reason. Only the user adds to this list.

- A highlighted or hovered row reaches 10px past the column on both sides, so rows stay square and hairlines straight.
- The current tab's fill reaches 10px past the column like a highlighted row, so the first tab's label starts on the title's edge.
- A highlighted row's band is inset 2px top and bottom, so two highlighted rows in a list don't touch; the row is still its full height.
- A highlighted term's band reaches 0.1em past its letters on both sides, so its letters sit where plain text would; at a line's start the band passes the column by that much.
- A chat bubble has one small corner, its tail, on the side of who wrote it.
- A control with no outline hangs its hover box past the column so its glyph's ink sits on the edge (`edge`).
- In the player, ✕ and "…" sit in the window's corners, not on the column, and the main action sits in the bottom-right corner on wide screens.
- Onboarding, the player and the buddy's conversation center one column; pages that are worked in never do.
- Content is flat: no shadows, few boxes. Body text is 14px in the app.
- Colored marks and words are soft until the device asks for more contrast. The main action is the text color.
- Facts lines are mono, uppercase where the role says so.
- A switch is a pill; meters are 6px with 3px corners.
- A caption directly under a full-width button is centered.
- Characters and flags are pictures with their own shapes and blank margins.

### Exceptions the user granted

Each is one named place where a rule above doesn't hold, by the user's decision. Leave them, and don't extend one to a neighbor. A case not listed here follows the rule: ask in your handoff (in a task with lanes, in [its exceptions file](../../../guides/orchestration.md#exceptions)), and add it here only once the user has accepted it.

- The landing page's hero headline and a blog post's title keep their own weight and line height (T1, T3).
- A lesson question's picture is centered in the column (E9).
- Pricing's Monthly and Yearly switch is not the tab piece: it's a control that looks pressable (X2).
- A code's boxes (a sign-in or account code) are 56px tall, a little taller than wide, in two groups of three that together are as wide as the button under them, not field-height squares (Z1).
- Tables in Admin and evals keep their roomier cells; they aren't tightened to a list row's height (D1).
- The day's bar on Today keeps its look and its parts' popovers; it is never made 44px tall to press (Z3).
- A row on Today that counts toward a mission keeps its small violet target (it isn't a paid mark, R4).
- Where plans are compared (pricing, the subscription page), a plan is named ("Plus"); the action still reads "Subscribe" (R4).
