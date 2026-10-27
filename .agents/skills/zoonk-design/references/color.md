# Color

Zoonk is neutral by default and colored on purpose, softly. Neutral tone steps (the page, `ground` for a public page's band, `card` for a panel, `muted` and `surface-3` for tracks and the row the learner is on) set a page's parts apart; color goes only where it means something, and it means the same thing on every screen. The values live in `packages/ui/src/styles/globals.css` (light, dark and both `prefers-contrast: more` modes). What each token means and where it goes lives in `apps/playground/src/design-system/color.ts`, shown live with every mode's value and contrast at `/design/color` in the playground (`http://playground.zoonk.localhost:1355/design/color` from the main checkout's `pnpm dev`; a worktree's address starts with its branch). Read it before giving anything a color; if this file and the module disagree, the module wins, so fix this file.

## One meaning per hue

- **The text color** is the action and the learner's pick: the main action (inverted), focus, and a pick before it's judged (`selected`: a 2px ring on `selected-tint`). Picks were blue; with progress blue a picked answer looked right before it was checked, so a pick takes the text color and checking always changes it.
- **Blue** (`success`, words in `success-text`) is progress made, up to where the learner is: done (a fill or a check), a right answer, studied, reached, a day of activity, good news in a plan change, a call's stars (progress, not a prize, so never gold), and the learner's place at the edge of their progress (a ring, or a dot with a halo).
- **Pink-red** (`destructive`, `destructive-text`) is wrong or removed: a wrong answer, bad news in a plan change, a destructive action, a one-line inline error.
- **Amber** (`warning`, `warning-text`) is look here: a flag, a suggestion, the one thing to improve. Icons and chips only, never a dot: an amber dot is review and practice.
- **Violet** (`brain`, `brain-text`) is Brain Power and nothing else: every reward amount (a readout's number, a result tile's number, a row's value), the missions' track and reward, the level page's bar of Brain Power toward the next level. A belt's ten levels are ticks in the belt's own colors (`BeltTicks`), not violet: they say which level, not how much Brain Power.
- **A kind's hue** (`kind-*`) says what a thing is, only through `KIND_MARKS` (`KindMark`, `KindDot`, `KindIcon`, `kindFillClass`, `kindTextClass`), where kinds sit side by side in one list. Kinds that do the same job share a hue and differ by icon: going back over what was learned (review, practice, mistakes) is amber, testing what the learner knows (a mock, a challenge) orange. A lesson, the default, is neutral; no kind is green.
- **A subject's hue** comes from one table in `globals.css` through `data-subject` (`getSubject`): `SubjectLabel` (its name on a soft tint) and `SubjectGlyph`, and its line on a course page (`bg-subject`). Never a surface wash, a button, a pick or progress.
- **Activity visuals** (`viz-*`) are three hues for data inside an interactive activity's canvas, never blue or violet.
- **Identity**: Energy is amber, a belt wears its full colors once reached (the one identity color that stays strong; documented with the tokens; a white belt's level ticks are ink, where white would vanish), the buddy and the Trickster keep their faces.

Everything else is neutral: titles, body and labels, panels and rows, tabs, navigation and its icons (the sidebar included), a goal's letter mark, and data that is none of the above (minutes, counts, dates, a subject's share of an exam, a timer).

## Rules

- **Soft, never alone.** Colored marks, icons, tints and colored words stay soft in the regular theme; the deeper, strict values belong only to `prefers-contrast: more`. Every colored mark has a word, a shape or screen-reader text that says the same, so a soft mark loses no meaning.
- **A tint belongs on something whose color is its meaning**: a checked answer under its ring, a plan diff's line, a flag's chip, a subject's label, an earned reward. Never on a button, a section, a heading or a band.
- **Checking changes a pick's color**: picked in the text color, then blue when right or pink-red when wrong, each with its word ("Correct", "Your answer"); a guess goes back to neutral. A set of toggles where many may be on (a week's study days) takes a 1px line on the tint, quieter than a single pick's 2px; keyboard focus is a separate outline, so a focused pick shows both.
- **A place shows once per view where it can**, in progress's blue as an outline or a dot with a halo, never a fill (a fill is done): the day's block in progress outlined, the current phase's band ringed, the next chapter's dot with a halo; its row keeps the neutral highlight.
- **A plan change is colored by what it means, not by its sign.** `PlanEffectDiff` colors only its outcome line through `getLessonLineTone` (`plan-diff/line-tone.ts`): lessons a date leaves out are pink-red, lessons added back blue, and without a date fewer lessons are blue and more are plain. Every date, end or count that moves is neutral: the old value struck through and muted, the new one in the text color. A worked answer's diff keeps right and wrong.
- **Done reads the same in every list**: one blue check (`DoneMark`) in the row's mark, the name never struck through and muted in a list of work to get through. A list of one kind shows state (`StatusMark`), not kind.
- **Missions**: one card (`MissionsCard`), each mission with its kind's icon until it's done; the track, the reward and the mark on the queue row a mission opens are violet. When every mission is done the reward lights up as a solid violet chip and the buddy's ring closes in violet: one of the few special moments, below.
- **Results tint their icons**, never their tiles: a `StatTile`'s icon takes its stat's tone (right answers blue, Brain Power violet, Energy amber, time neutral), and Brain Power's number is violet too, as every reward amount.
- **Special moments may be louder, never different**: a solid fill and a short motion when something is earned (today's missions complete, a mission done, Brain Power earned), each once, never on load, with a calm reduced-motion version (`/design/moments`; the motion itself: [zoonk-motion](../../zoonk-motion/SKILL.md)).
- **Tint in sRGB**: `color-mix(in srgb, …)`, Tailwind's `/15` opacity or relative color. Mixing in oklch against a see-through black (`--border` is `oklch(0 0 0 / 7%)`) pulls the hue toward red.
- **One source per meaning**: a kind's color and icon only from `KIND_MARKS`, a subject's only from the hue table, Brain Power's only from `brain`; a new meaning gets a token, its light, dark and more-contrast values, and its row in `apps/playground/src/design-system/color.ts`. No screen spells a palette class (`text-emerald-600`, `bg-blue-500`) or an arbitrary hex.

## Hierarchy without color

- **The main action is the strongest thing on a screen**: inverted, one per area. Secondary actions are outline, tertiary ghost; a link inside a sentence stands out by its weight, in the text color.
- **Three text steps**: `foreground` for titles and body, `muted-foreground` for supporting lines, meta, trailing numbers and a readout's unit, `faint` for eyebrows, list numbers and axis labels. All three are AA on every surface they sit on, in every mode.
- **Weight and size before color**: titles, not labels (`PageSectionTitle`, `text-section`), a readout's big number, then the quiet steps. Three levels of type in a block at most.
- **Group with spacing and hairlines** before adding a container; a panel holds one self-contained thing. In light the page and panels are both white and a panel reads by its hairline; in dark a panel is a step lighter than the page.

## Contrast

- Neutral text is AA (4.5:1) on every surface it sits on, in every mode.
- Colored words sit near 4.5:1 on the page in the regular theme and a little under on their own tints; marks may sit under 3:1. That's the owner's choice for a soft theme, and why color is never the only cue. With more contrast asked for, every color is strict (7:1 and up).
- The design system's color page measures every token in every mode; check new pairs there instead of copying ratios into documents.
- With more contrast asked for, a field's line is already the text color at rest, so focus shows by thickness: a band at least 2px wide whose pixels change by 3:1 or more (WCAG 2.4.13), such as the app's 3px field ring.

## Native apps

Apple and Android take the same meanings and values with native controls. The tint of prominent buttons and toggles is the label color (black in light, white in dark), so Apple's `AccentColor` and Android's Material `primary` are that ink, and Android's dynamic color stays off (it would bring the wallpaper's hue in). Each token becomes a named color with light and dark values plus a high-contrast variant: Apple's asset catalog "High Contrast" appearance (Increase Contrast), and Android's contrast levels (`UiModeManager.getContrast()`, Android 14 and up) choosing the more-contrast values. Picks are ink, progress and the learner's place blue, wrong pink-red, Brain Power violet, kinds their hues on icons.

## Sources

- Owner's decisions, October 2026: soft colors, no green, pink errors, strict contrast only under `prefers-contrast: more`, the sidebar unchanged, a few louder moments.
- Dieter Rams and Dietrich Lubs's Braun ET66: a quiet body where color marks only the keys with a different job ([Core77](https://www.core77.com/posts/24935/braun-re-issuing-classic-et66-calculator-24935)).
- Linear, "Behind the latest design refresh" (2026): navigation "should recede"; "Don't compete for attention you haven't earned" ([article](https://linear.app/now/behind-the-latest-design-refresh)).
- Vercel Geist: gray by default for text, icons, fills, borders and dividers; Background 2 used sparingly ([Geist colors](https://vercel.com/geist/colors)).
- Apple Human Interface Guidelines: "Avoid using the same color to mean different things" ([Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- Material 3 color contrast levels ([Material](https://m3.material.io/foundations/designing/color-contrast)).
