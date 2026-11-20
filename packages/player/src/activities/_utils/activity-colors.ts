/**
 * What each color means inside an activity, on the web, Apple and Android alike. The rules are in
 * `zoonk-design/references/color.md`; this is their table for a canvas. A canvas takes a color for
 * what it means, never for looks, and there is no green.
 *
 * | Role       | Color                    | Means                                                                  |
 * | ---------- | ------------------------ | ---------------------------------------------------------------------- |
 * | `data`     | teal, then purple, amber | What the canvas draws and measures, one hue per series. A readout wears the hue of what it measures. |
 * | `working`  | teal line                | The box, square or note the learner is working on.                     |
 * | `placed`   | ink                      | What the learner placed or was given, before a check.                  |
 * | `right`    | blue                     | The right answer once checked, in the learner's mark or shown to them. |
 * | `missed`   | blue, dashed             | A right answer the learner didn't give.                                |
 * | `wrong`    | pink-red                 | The learner's wrong mark once checked.                                 |
 * | `guess`    | neutral gray             | A guess, and what was taken away: never right or wrong.                |
 * | `lookHere` | amber                    | A flag or a hint to look at. Never a result.                           |
 * | `reward`   | violet                   | Brain Power, which no canvas draws.                                    |
 *
 * Each role's classes: `text` for words and numbers, `soft` for a tint behind them, `solid` for a
 * filled mark with its own text color, `box` for a box's 2px line, drawn inside it so nothing moves.
 */
export const ACTIVITY_COLOR = {
  data: {
    soft: "bg-viz-accent-soft",
    solid: "bg-viz-accent text-background",
    text: "text-viz-accent",
  },
  dataSecond: {
    soft: "bg-viz-secondary-soft",
    solid: "bg-viz-secondary text-background",
    text: "text-viz-secondary",
  },
  dataThird: {
    soft: "bg-viz-highlight-soft",
    solid: "bg-viz-highlight text-background",
    text: "text-viz-highlight",
  },
  guess: {
    box: "border-muted-foreground border-2 border-dashed",
    soft: "bg-muted-foreground/20",
    text: "text-muted-foreground",
  },
  lookHere: { soft: "bg-warning/10", text: "text-warning-text" },
  missed: { box: "border-success border-2 border-dashed", text: "text-success-text" },
  placed: { solid: "bg-foreground text-background" },
  reward: { text: "text-brain-text" },
  right: {
    box: "border-success ring-success ring-1 ring-inset",
    soft: "bg-success/10",
    solid: "bg-success-text text-background",
    text: "text-success-text",
  },
  working: { box: "border-viz-accent ring-viz-accent ring-1 ring-inset" },
  wrong: {
    box: "border-destructive ring-destructive ring-1 ring-inset",
    soft: "bg-destructive/10",
    solid: "bg-destructive-text text-background",
    text: "text-destructive-text",
  },
} as const;
