# Zoonk's design system on Android

Main's design system (`apps/playground/src/design-system/`, values in `packages/ui/src/styles/globals.css`) says what each thing means. On Android each meaning takes the closest Material role, type style or component, so the platform handles font scale, dark theme, contrast and new windows. The theme lives in `apps/android/app/src/main/kotlin/com/zoonk/android/ui/theme/`, the shared pieces in `ui/components/` and `ui/format/`. Composables read roles, never values.

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
