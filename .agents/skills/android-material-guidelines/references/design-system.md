# Zoonk's design system on Android

Main's design system (`apps/playground/src/design-system/`, values in `packages/ui/src/styles/globals.css`) says what each thing means. On Android each meaning takes the closest Material role, type style or component, so the platform handles font scale, dark theme, contrast and new windows. The theme lives in `apps/android/core/designsystem/src/main/kotlin/com/zoonk/android/ui/theme/`, the shared pieces in `ui/components/` and `ui/format/` beside it. Composables read roles, never values.

## Ground rules

- **Zoonk's scheme, never dynamic color.** `ZoonkTheme` holds four schemes generated from `globals.css`: light, dark, and each with more contrast. A device contrast level of 0.5 or more (medium or high, API 34+) picks the more-contrast scheme, followed live.
- **Primary is ink.** Filled buttons, text buttons, checked controls and the selected navigation item are black in light and white in dark, as on main.
- **Color means something or stays neutral.** Before you color something, find its role below. If none fits, use `onSurface` or `onSurfaceVariant`.
- **Never color alone.** A word, a symbol or a shape says the same thing.
- **Soft in the standard schemes, strict with more contrast.** Lines (`outline`, `outlineVariant`) and colored words are soft by design; the more-contrast schemes make them strong. Don't darken a role to fix one screen.

When `globals.css` changes, regenerate the palette: `pnpm --filter android palette && make -C apps/android format`.

## Color roles

| Main token                                                  | Compose                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `background`                                                | `background`, `surface` (what `Scaffold` draws), `surfaceContainerLowest`                                                   |
| `card`, `popover`                                           | `surfaceContainerLow`, `surfaceContainer` (cards, sheets, menus and the navigation bar draw their own)                      |
| `muted` (the row the learner is on), `surface-3` (a track)  | `surfaceContainerHigh`, `surfaceContainerHighest`                                                                           |
| `border`, `input`                                           | `outlineVariant`, `outline`                                                                                                 |
| `foreground`, `muted-foreground`, `faint`                   | `onSurface`, `onSurfaceVariant` (both quiet steps)                                                                          |
| `primary` (the main action)                                 | `primary` / `onPrimary`                                                                                                     |
| `selected` (a pick before it's checked)                     | `primary` ink: radio, checkbox, a 2dp ring on `MaterialTheme.zoonk.selectedTint` (`answerTone`). Never blue.                |
| `success` (progress, done, right, the learner's place)      | `tertiary`; its tint `tertiaryContainer`. Pass `tertiary` to progress indicators: Material defaults to `primary`.           |
| `success-text` (progress in words)                          | `onTertiaryContainer`, on the page or on the tint                                                                           |
| `destructive`, `destructive-text` (wrong, removed)          | `error` takes `destructive-text`, since Material writes field errors in it; tint `errorContainer`, words `onErrorContainer` |
| `warning`, `warning-text` (look here)                       | `MaterialTheme.zoonk.warning`, `warningText`                                                                                |
| `brain`, `brain-text` (Brain Power, only)                   | `MaterialTheme.zoonk.brain`, `brainText`                                                                                    |
| `energy`                                                    | `MaterialTheme.zoonk.energy`                                                                                                |
| `kind-*`                                                    | `LearnKind.color`, drawn by `KindMark` and `KindDot`                                                                        |
| `belt-*`                                                    | `Belt.color`: full strength in every scheme, drawn by `BeltDot`                                                             |
| `viz-accent`, `viz-secondary`, `viz-highlight`              | `MaterialTheme.zoonk.vizAccent`, `vizSecondary`, `vizHighlight`: a chart's series, in that order                            |
| `[data-subject]`: `subject`, `subject-text`, `subject-tint` | `Subject.colors` (`ZoonkColors.subjects`), drawn by `SubjectGlyph` and `SubjectLabel`                                       |

`ZoonkColors` holds only meanings Material has no role for. Add one only when no role carries it without colliding with another meaning: its token in the generator's list, then `ZoonkColors`.

## Type

The default Material 3 `Typography`, system font, sizes in `sp`.

| Design-system role          | Material style                                                                 |
| --------------------------- | ------------------------------------------------------------------------------ |
| Display                     | `displaySmall`                                                                 |
| Headline                    | `headlineSmall`                                                                |
| Title                       | `titleLarge` (a top app bar's title)                                           |
| Section, Section in the app | `titleMedium` (`SectionHeader`, a TalkBack heading)                            |
| Lead, Body                  | `bodyLarge`                                                                    |
| Supporting line, meta       | `bodyMedium` in `onSurfaceVariant`                                             |
| Label                       | `labelLarge`; small facts `labelMedium`                                        |
| Readout (a big number)      | `displaySmall.withTabularFigures()`, its unit smaller in `onSurfaceVariant`    |
| Mono (data that lines up)   | the line's style `.withTabularFigures()`; `FontFamily.Monospace` only for code |

Three levels of type in a block at most; weight and size lead, color only quiets.

## Shape and spacing

Material's `shapes` and component defaults. Shape carries no meaning in the design system, so the theme doesn't override it. Spacing comes from component defaults and content padding; group with spacing and `HorizontalDivider` before adding a container.

## Foldables

[Book foldables](../../zoonk-design/references/foldables.md) holds the product rule and what goes on each side for each kind of screen, the same as on the open iPhone Duo. On Android:

- **Navigation:** Material's default suite: a bar when folded or in tabletop, a rail when unfolded (medium and expanded windows), and the drawer only on large windows (1200dp and wider, with a medium height), where two panes still fit beside it.
- **Pages:** `PageWithSupportingPane` lays out a page and its aside; the shell's Navigation 3 list and detail (`ListDetailSceneStrategy`, settings, shown only where a list leads, so a settings page opened on its own is a page of its own) and Statistics' `ListDetailPaneScaffold` take the same `pageDirective`. It gives two panes where each keeps at least 240dp, more as the font scale passes 1, measured as Material sizes them: where Material splits the window (expanded and wider), and where a vertical fold crosses the page, flat or half opened, so a Galaxy Z Fold's medium window splits too (Material's `calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth`). At a fold the panes meet at it through `excludedBounds`. A lone pane never gets the fold: Material would squeeze it into the side before it. Don't put another width gate in front of these; they decide.
- **Only at a fold:** `atFoldOnly = true` splits a page only where a fold crosses it, for pages that keep main's own layout on wider windows (the catalog's course, chapter, lesson and list pages).
- **Spreads:** the lesson player splits only where a fold crosses it (`pageFold`) and both pages have room (`supportingPaneBeside`), since wider windows keep main's one column. The learner's turn stays the column it is without a fold, padded past the fold, and the screen is a second column before it, so placed words, filled blanks and typed answers survive folding and unfolding; each column is a TalkBack traversal group, read in page order.
- **Bars:** `DockedActionBar` puts its actions on the page after a fold that crosses it, and `PageScaffold` and `TaskScaffold` give each page its part of the top bar (back or leave and the title over the page before the fold, the actions over the page after it), so a one-column task keeps its bars off the fold. Scaled or partly hidden placements (a page shrinking under predictive back) don't count, so a page keeps its panes mid-gesture. Search keeps its bar, docked panel and full-screen results to the page before the fold. Sheets come from `ui/components/ModalBottomSheet`, never Material's directly: it puts a sheet on the page after the fold, as the open iPhone Duo moves its sheets, so Ask in a lesson covers the learner's turn and leaves the question in view. A control outside a pane reads `pageFold(width)` (where the fold starts and ends from the layout's start edge, or null) and keeps off the fold the same way.
- **Inside a pane:** a pane is about a phone wide even on a wide window, so what's inside it chooses its layout by the pane's measured width, not the window's size class, as Statistics' page does beside its list.
- **The hinge:** a `FoldingFeature` is `FLAT` or `HALF_OPENED`, `isSeparating` while half opened (always, on a dual screen), and `occlusionType` `FULL` where a hinge hides content. Zoonk keeps content off the fold in every state, so nothing moves when the device folds. The angle isn't in the API; never tie a feature to a posture.
- **Outer display:** a compact window: the bar and one column, as on any phone.
- **Continuity:** folding and unfolding recreate the activity. What the learner made lives in view models, `DraftHandle`s and saveable state, so their place, their text and the scroll position survive.

### Testing on a foldable

- **The emulator:** the `Pixel_Fold` AVD is a Pixel 10 Pro Fold: an inner display of 2076×2152 px at 390 dpi (852×883 dp, an expanded window, the fold at 426 dp) and an outer one of 1080×2364 px. Boot and share it by the [emulator rules](../../../../apps/android/AGENTS.md#emulators-and-builds).
- **Poses:** `adb -s <serial> emu posture 3` opens it flat, `2` half opens it (a book in portrait, a tabletop once rotated) and `1` closes it to the outer display; `adb -s <serial> emu sensor set hinge-angle0 <degrees>` sets an angle. Rotate with `adb -s <serial> shell settings put system accelerometer_rotation 0`, then `user_rotation 1` (and `0` back).
- **Staying awake:** folding locks the device unless apps continue on fold (`adb -s <serial> shell settings put system fold_lock_behavior_setting stay_awake_on_fold_key`); a test AVD without a screen lock also needs `adb -s <serial> shell locksettings set-disabled true`, or folding lands on the lock screen.
- **Screenshots:** with two displays, name one: `adb -s <serial> exec-out screencap -p -d <display id> > screen.png`, the ids from `adb -s <serial> shell dumpsys SurfaceFlinger --display-id` (the inner display first, the outer one second).
- **Pages:** open one as an App Link would: `adb -s <serial> shell am start -n com.zoonk.debug/com.zoonk.android.MainActivity -a android.intent.action.VIEW -d https://www.zoonk.com/plan`.
- **A Galaxy Z Fold:** `adb -s <serial> shell wm size 1856x2160` and `wm density 420` give its 707×823 dp medium window, but the emulator then reports no fold, so it shows only the layout without one; `wm size reset` and `wm density reset` undo it. Cover its split in Robolectric at `w707dp-h823dp`.
- **Robolectric:** `androidx.window:window-testing` publishes a fold to a test: `WindowLayoutInfoPublisherRule` as `@get:Rule(order = 0)` before the compose rule, then, after `setContent`, `overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(FoldingFeature(activity, state = …, orientation = FoldingFeature.Orientation.VERTICAL))))`. Its default orientation is horizontal, a tabletop. `PageWithSupportingPaneTest` and `TaskScaffoldTest` show the pattern at `w852dp-h883dp` and `w707dp-h823dp`.
- **What to check:** the outer display; the inner display flat and half opened as a book; on its side flat and as a tabletop; the Galaxy Z Fold's width; large text; and that folding or unfolding mid-task keeps the learner's place.

## Components

- **Actions:** the main action `Button`; a secondary action `FilledTonalButton` (muted fill, ink words); a quiet one `TextButton`. `OutlinedButton` writes its label in `onSurfaceVariant`, Zoonk's supporting-words gray, so it reads as disabled beside ink.
- **Selection:** `RadioButton`, `Checkbox`, `Switch` and `FilterChip` as they are; a selected `FilterChip` shows a check (`leadingIcon`) so the state isn't color alone.
- **`LabelChip`:** main's quiet chip, a few words beside a title (Plus, "1 week"), optionally with a symbol. Not tappable; a chip people tap is `AssistChip` or `FilterChip`.
- **`Meter`, `MeterParts`:** a share on a track in `tertiary` (Energy and Brain Power pass their color), and a meter of weighted parts (`Track`, `Place`, `Solid`). Hidden from TalkBack unless given a `contentDescription`, since the words beside them say the number.
- **`StatusMark`, `DoneMark`, `ProgressMark`:** done is one blue check; skipped a quiet fast-forward; the learner's place a blue dot with a halo, never a fill; ahead a faint dot; part done a blue ring filling on the track. Marks are one line of body text tall, so they grow with the font.
- **`ListRow`:** main's list row, at least 48dp: a mark (`ListRowLeading`), medium-weight words with their numbers or date at the end (`TitleAndMeta` moves them under the words at large text), and a chevron (`ListRowChevron`) where it opens a page. It sits inside the column's margin and reaches 8dp past it, so the learner's place is highlighted inset from the edges; `expanded` makes it open what's under it and tells TalkBack whether it's open.
- **`KindMark`, `KindDot`:** a kind's symbol or dot in its color, only where kinds sit side by side. A list of one kind shows state instead.
- **`BeltDot`, `BeltLevel`:** the belt in its color with an edge, and the level button's content (dot and number, read as "Yellow belt, level 3"); the button says where it goes with `onClickLabel`.
- **`answerTone`, `AnswerTag`:** an answer piece's line, fill and words for idle, picked, right, wrong and guess, and the word a checked piece shows ("Correct", "Your answer", "Your guess"). The words stay `onSurface`; only the line and fill change.
- **`LessonVisual`:** main's chart (bars or lines, up to three series) and timeline, from a value type each caller reads its API model into with `recode()`. TalkBack reads a chart's values in place of the drawing.
- **`StatusMessage`, `LoadFailedMessage`, `EmptyState`:** a screen that couldn't show (centered, the main action first) and a place with nothing yet (start-aligned, no card).
- **Formatting (`ui/format`):** `formatNumber`, `formatAmount` (money and units, compact for axes), `formatPercent`, `formatProgressShare`, `formatDuration`, `formatMinutes`, `formatDate` with main's `DateStyle`s and `formatTimeOfDay` on the device's clock, all with `currentLocale()`. They write what main's `@zoonk/utils` writes.
- **Plus locks:** the same screen locked with the subscribe action, never a different screen.
- **Celebrations:** a full-screen `Dialog`, once, never on load, still when the animator duration scale is 0.

## Icons

Material Symbols as vector drawables (Outlined, weight 400, grade 0, 24): `pnpm --filter android symbol <name>` adds `res/drawable/ic_<name>.xml`, `--filled` its filled twin for a selected navigation item, `--mirrored` flips a directional one in right-to-left layouts. Pick the closest symbol to main's lucide icon and Apple's SF Symbol, and name both in the mapping's comment: `PlaceIcon` for the app's places, `LearnKind` for kinds. Outlined everywhere else; filled only for a selected navigation item and a mark main fills (skipped).

## Gallery

Debug builds include a gallery of every role and shared piece: `adb shell am start -n com.zoonk.debug/com.zoonk.android.gallery.GalleryActivity`, or the previews in `ComponentGallery.kt` (all four schemes). Review screenshots of every section in every scheme, at 200% font and right to left: `./gradlew :app:testDebugUnitTest --tests '*GalleryScreenshots*' --rerun -Pzoonk.shots=<folder>`. Add a section when you add a shared piece.
