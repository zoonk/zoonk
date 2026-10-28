# Zoonk's design system on Apple platforms

Main's design system (`apps/playground/src/design-system/`, values in `packages/ui/src/styles/globals.css`) says what each thing means. On Apple platforms each meaning takes the closest **system** API, so iOS handles Dynamic Type, Dark Mode, Increase Contrast, Reduce Motion, Liquid Glass and new devices. Don't re-create main's values: no hex colors, no bundled web fonts, no fixed font sizes, no custom controls where a native one exists.

The app's code for this lives in `apps/apple/Zoonk/DesignSystem/`. It only names meanings and draws the few things the system doesn't.

## Ground rules

- **Minimum iOS 26.** Liquid Glass, `.glass` button styles, `ConcentricRectangle` and `safeAreaBar` need no `#available` checks.
- **The tint is ink.** `AccentColor` points at the system `labelColor`, and `ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME` applies it. Buttons, links, the selected tab and default `ProgressView`s are black in light mode and white in dark, as on main. Don't set `.tint` on screens, except for toggles (see Components).
- **Color means something or stays neutral.** Before you color something, find its role below. If none fits, use `.primary`, `.secondary` or `.tertiary`.
- **Never color alone.** A word, an SF Symbol or a shape says the same thing.

## Color roles

| Main token                                                        | SwiftUI                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `background`                                                      | Nothing: the system background (`List`/`Form` draw grouped backgrounds themselves). A plain page uses `.background`.      |
| `card` (`Surface`)                                                | A `List`/`Form` section, `GroupBox`, or `Color(.secondarySystemGroupedBackground)` on a `.systemGroupedBackground` page   |
| `popover`                                                         | Native sheets, menus and popovers                                                                                         |
| `muted` (the row the learner is on)                               | `Color(.tertiarySystemFill)`                                                                                              |
| `surface-3` (a meter's track)                                     | `Color(.systemFill)`. `ProgressView` draws its own track.                                                                 |
| `border`, `input`                                                 | `.separator`. List separators and bordered controls draw their own.                                                       |
| `foreground`, `muted-foreground`, `faint`                         | `.primary`, `.secondary`, `.tertiary`                                                                                     |
| `primary` (the main action)                                       | `.buttonStyle(.mainAction)`                                                                                               |
| `selected` (a pick before it's checked)                           | Ink: `.strokeBorder(.primary, lineWidth: 2)` over `.fill.quaternary`. Never blue: blue would say "right".                 |
| `success`, `success-text` (progress, the learner's place)         | `.success` (system blue)                                                                                                  |
| `destructive`, `destructive-text` (wrong, removed, inline errors) | `.destructive` (system pink). A destructive action is `Button(role: .destructive)`, which the system draws red.           |
| `warning`, `warning-text` (look here)                             | `.warning` (system orange)                                                                                                |
| `brain`, `brain-text` (Brain Power, only)                         | `.brain` (system indigo, the system's violet). System purple now sits at fuchsia, which is the mind map's hue.            |
| `energy`                                                          | `.energy` (system yellow)                                                                                                 |
| `kind-*`                                                          | `LearnKind.color`, drawn by `KindMark` / `KindDot`                                                                        |
| `belt-*`                                                          | `ProgressBelt.color`: system colors at full strength in every mode, with a faint outline so white and black never vanish. |
| `viz-accent`, `viz-highlight`, `viz-secondary`                    | `.mint`, `.orange`, `.purple`. The `-soft` fills are the same color at `.opacity(0.15)`.                                  |

Hues were matched in OKLCH against the iOS 26 system colors, which are more saturated than main's soft tokens. Increase Contrast darkens system colors in light mode and lightens them in dark, which matches main's `prefers-contrast: more` modes.

**The one custom color is `kind-mock`** (`Resources/Assets.xcassets/Kinds/`). A mock and a challenge need an orange redder than review's. The system has no such hue, and system red sits about 8° from wrong's pink. It has light, dark and high-contrast variants copied from `globals.css`. Add another named color only when no system color can carry a meaning without colliding with another one, and record why here.

**Subjects.** On iOS a subject is named in words. Its color goes on a small glyph beside the name (main's `SubjectGlyph`), never on the words, because system colors such as yellow fail as text. Use `Label { Text(name) } icon: { Image(systemName: "square.fill").foregroundStyle(hue) }`, with these nearest system hues:

| Subject                          | Hue       |
| -------------------------------- | --------- |
| health                           | `.pink`   |
| languages                        | `.red`    |
| history                          | `.orange` |
| culture                          | `.brown`  |
| law, business                    | `.yellow` |
| society, economics               | `.green`  |
| geography                        | `.mint`   |
| science                          | `.teal`   |
| math                             | `.cyan`   |
| communication, engineering, tech | `.blue`   |
| exams, general                   | `.indigo` |
| arts                             | `.purple` |

## Type

Use the system font through text styles. Dynamic Type, Bold Text and every language's fallback fonts then work for free. Main's Geist isn't bundled.

| Main role                                           | SwiftUI                                                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text-title` (a page's or task's title)             | `.navigationTitle` with `.toolbarTitleDisplayMode(.inlineLarge)` on tab roots. Never a `Text` header.                                                                            |
| `PageSectionTitle` (a page's block)                 | A `Section` header, or `.headline`, in title case. iOS 26 no longer uppercases list headers.                                                                                     |
| `text-section`, `text-headline`                     | `.title2.weight(.semibold)`, `.largeTitle.bold()`                                                                                                                                |
| `text-lead`                                         | `.body` in `.secondary`                                                                                                                                                          |
| Body, a row's title                                 | `.body`                                                                                                                                                                          |
| A row's second line, meta                           | `.subheadline` in `.secondary`. Notes under a section go in `.footnote`.                                                                                                         |
| `text-label` (uppercase, inside a panel only)       | `.caption.weight(.medium)`, `.secondary`, `.textCase(.uppercase)`                                                                                                                |
| `text-readout` (`BigQuantity`)                      | `.largeTitle.weight(.semibold).monospacedDigit()`, with the unit in `.title3`/`.subheadline` `.secondary` beside it. Changing numbers take `.contentTransition(.numericText())`. |
| Mono data (minutes, counts, a row's trailing value) | `.monospacedDigit()` on the row's style. An eyebrow over a title is `.caption.monospaced()` in `.tertiary`.                                                                      |

Never write `.font(.system(size:))` for text. An SF Symbol takes the font of the text beside it, plus `.imageScale` if it needs to change size.

## Shape and spacing

Use the system's: default `padding()`, `.scenePadding()`, `.contentMargins`, list row heights (44pt or more), and the corner radii of `List`, `GroupBox` and buttons. A custom panel that can't be a list uses `.continuous` rounded corners, like the Progress cards. Inside a container with a shape (a sheet, a glass group), use `ConcentricRectangle()` so corners nest.

The only tokens are where main's structure needs something the system lacks:

- `MeterParts`: 6pt tall, parts 2pt apart.
- `StatusMark`: one scaled width, so a list's words start in one column.
- `.chip()` padding.

## Components

| Main                                                        | SwiftUI                                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Button` (default): one main action per area                | `.buttonStyle(.mainAction)`, with `.controlSize(.large)` for a screen's action                                                    |
| `outline` (secondary)                                       | `.buttonStyle(.bordered)`                                                                                                         |
| `ghost`, a quiet option under the main action               | `.buttonStyle(.borderless)`                                                                                                       |
| `link` (an action inside a sentence)                        | `Link`/`Button` with `.underline()` text. The tint is ink, so a link without an underline looks like text.                        |
| `destructive`                                               | `Button(role: .destructive)` with `.bordered`                                                                                     |
| A floating control (the player's ✕ and ⋯, a map's controls) | A toolbar item (glass comes free), or `.buttonStyle(.glass)`                                                                      |
| `ListGroup` flat (a page's list)                            | `List` with `.listStyle(.plain)`                                                                                                  |
| `ListGroup variant="panel"`, `Surface`                      | An inset-grouped `List`/`Form` section, or `GroupBox`                                                                             |
| `ListRow*`                                                  | Native rows: `NavigationLink` (chevron included), `Label`, `LabeledContent`; a row-end value is `.badge(_:)`                      |
| `StatusMark`, `DoneMark`                                    | `StatusMark(status:)`; done is `.done`                                                                                            |
| `KindMark`, `KindDot`                                       | `KindMark(kind:)`, `KindDot(kind:)`                                                                                               |
| `Meter`                                                     | `ProgressView(value:total:)` with `.tint(role)`                                                                                   |
| `MeterParts`                                                | `MeterParts(parts:)`                                                                                                              |
| Chip (Plus, "1 week", a status)                             | `.chip()`                                                                                                                         |
| `StatTile`                                                  | A panel with a `Label` (its symbol in the stat's role color) over a readout                                                       |
| `NoticeCard`, `Suggestion`                                  | `GroupBox` with a `Label`                                                                                                         |
| Empty, error, signed-out states                             | `ContentUnavailableView`                                                                                                          |
| Switch                                                      | `Toggle`, with `.tint(.success)` on its `Form`. The system default is green, and an ink switch hides its white knob in dark mode. |
| Segmented choices, menus, dialogs, sheets                   | `Picker` with `.pickerStyle(.segmented)`, `Menu`, `.confirmationDialog`, `.alert`, `.sheet` with detents                          |
| The task's action bar                                       | `.safeAreaBar(edge: .bottom)` holding a `.mainAction` button, so it gets the scroll edge effect                                   |
| `ShortcutKbd` (⏎ on the main action)                        | `.keyboardShortcut(.defaultAction)`; Esc is `.keyboardShortcut(.cancelAction)`                                                    |
| The buddy and the Trickster                                 | `BuddyCharacter`, `TricksterCharacter`, `BuddyFace` beside words (see Characters)                                                 |

## Liquid Glass

- Glass belongs to the navigation and control layer, never to content: `TabView`, `NavigationStack` bars, toolbars, sheets, menus and floating controls. They adopt it on their own.
- Don't paint backgrounds on bars, tab bars or toolbars. Custom backgrounds there break glass and the scroll edge effect.
- Content (rows, panels, readouts, answer options) stays opaque on system backgrounds.
- `.glassProminent` is not the main action. With the ink tint its white label vanishes on dark mode's white glass, and recoloring it doesn't help because glass draws labels vibrantly (they turn gray). Use `.mainAction`, in a `safeAreaBar` when it floats.
- Several custom glass controls together go in one `GlassEffectContainer`.
- Group toolbar items by job, separate groups with `ToolbarSpacer(.fixed)`, and give every icon-only item an accessibility label.
- Reduce Transparency and Increase Contrast restyle glass on their own. Don't fight them with custom materials.

## Motion

Everyday screens stay still. Feedback uses the system's: control states, `.contentTransition`, `.symbolEffect`. Celebrations move once, only when something is earned:

| Main                                  | SwiftUI                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| quick/base, ease-out (a state change) | Native control animations, or `.animation(.snappy, value:)`                                           |
| spring (something earned lands)       | `.bouncy`: it is SwiftUI's `Spring(duration: 0.5, bounce: 0.3)`, which main's `--ease-spring` samples |
| fill and count-up (700ms)             | `withAnimation(.easeOut(duration: 0.7))` with `.contentTransition(.numericText())` on the number      |
| pop (a mark swells once)              | `.symbolEffect(.bounce, value:)`                                                                      |

Reduce Motion: system controls and symbol effects adapt on their own. A celebration you animate yourself reads `@Environment(\.accessibilityReduceMotion)` and shows its end state with no animation (`withAnimation(reduceMotion ? nil : .bouncy)`).

## Every device

- Choose layouts by size class and available space, never by device. `userInterfaceIdiom`, screen bounds, orientation and known screen sizes are wrong on iPhone Duo and in resizable iPad windows. Measure with `onGeometryChange`, and use `ViewThatFits` and native containers.
- **iPhone Duo** (iOS 27.1 SDK, which Xcode 27.1 builds with): on the inner display the app fills the screen, the status bar sits on the right edge, and the tab bar stands vertically below it, showing **icons only**. Every tab's SF Symbol must read on its own, with its title kept as the label for VoiceOver. Content keeps clear of the bar through the safe area. Don't crop media with `.aspectRatio(contentMode: .fill)` without a focal point.
- **iPad**: `sidebarAdaptable` tabs become a top tab bar or a sidebar. Rows and panels keep the same roles; grids gain columns as the width grows.
- **Simulators**: a headless iPhone Duo renders black until something attaches a display (agent-device or Simulator). `agent-device fold closed|half-open|open` sets the pose (half-open is the partial fold); when it reports that the hinge read-back failed, the pose usually still applied, so check a screenshot. `simctl io <udid> screenshot --display=primary-1` captures the inner display and `--display=primary` the outer one. `simctl ui <udid> appearance|increase_contrast|content_size` sets each mode for checks.

### iPhone Duo

Open, the Duo reads like an open wallet: two panes either side of the fold, each about an iPhone wide, so the phone's views go in unchanged. `PaneSplit` places them; its `single` builder is the phone's one column. Folding or unfolding keeps the learner's place.

| Screen kind                                      | Leading pane                                                      | Trailing pane                                                                            | `primaryShare` |
| ------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------- |
| Spread: lesson player, practice, the mock runner | the screen: question or title, teaching, stimulus, worked example | the learner's turn: options, fields, canvas, feedback, with the action bar at its bottom | 0.5            |
| Main and supporting: Today, Plan, Buddy, Exam    | the main content                                                  | what supports it: missions, the week, numbers, settings                                  | 0.55           |
| List and detail: Statistics                      | the list                                                          | the selected item                                                                        | 0.5            |

- In the lesson player, Previous and the main action stay at the bottom of the trailing page on every screen. A screen with a picture, visual or canvas puts it on the trailing page; a text-only screen leaves the trailing page empty above Continue, so Continue never moves.
- Side panels (Ask, the buddy's day, the mock answer sheet, the call aside) stay `.inspector` on regular widths and sheets on compact widths: partially folded, the system moves the inspector's edge to the fold.
- One-column screens (onboarding, results, celebrations) let their scrolling content cross the fold and move their bottom action off it with `.keepsOffFold()`.

## Pitfalls

- An ink tint makes every `.borderedProminent` label white on white in dark mode. That is why `.mainAction` exists. Don't use `.borderedProminent` directly.
- The asset `AccentColor` reaches neither `Toggle` nor `UISwitch.appearance()` in SwiftUI. Tint toggles explicitly.
- `Color.purple` is fuchsia since iOS 26. Brain Power is `.brain` (indigo).
- `Text + Text` is deprecated since iOS 26. Interpolate styled texts into one `Text` instead, for example a readout and its unit: `Text("\(Text(minutes, format: .number).font(.largeTitle.weight(.semibold)).monospacedDigit()) \(Text(unit).foregroundStyle(.secondary))")`.
- A fixed `.frame(height:)` around text breaks at accessibility sizes. Let text set the height, or use `@ScaledMetric`.

## Characters

`DesignSystem/Characters` ports main's rig (`packages/ui/src/components/_buddy`, `trickster.tsx`, their acts) point for point: main's SVG path data is read by `Path(svg:)`, each character draws into one `Canvas` as named parts, each posed around its own pivot, and acts are main's `BUDDY_ACTS`/`TRICKSTER_ACTS` as data (frames at 24 a second, main's curve tokens as `ActEase`). One canvas keeps them crisp at any size and cheap; a `TimelineView` runs only while an act plays, so a character on an everyday screen costs nothing.

- `BuddyCharacter(look:expression:crop:reaction:cue:)`: `BuddyLook` (kind, glasses, belt, Energy) from `LearnerSummary.buddy` grows it and picks its everyday face. `TricksterCharacter(beaten:reacts:cue:)`. `BuddyFace` is the face at text size, for labels and pickers.
- A `reaction` plays once when the view appears, where the learner's work just did something (pass none on a revisit, and the landing expression instead); a `cue` plays on each change of its id (a duel's verdict). Reduce Motion lands the act's expression at once.
- Their colors are artwork (`Color(art:)`), the same in light and dark as main draws them; the belt takes `ProgressBelt.color`. They're decorative: `accessibilityHidden`, with the moment's words carrying the meaning.
- `Burst` flies the rarest moments' sparks once (a belt, the buddy's next stage). `MilestoneStage` is a ceremony's picture.
- See every drawing and act in a Debug build launched with `ZOONK_DEBUG_CHARACTERS=1` (`=ceremony` for a milestone's ceremony), the native side of main's `/design/characters`.
