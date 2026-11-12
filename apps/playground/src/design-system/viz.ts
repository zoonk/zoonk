import { type ColorGroup } from "./color";

export const VIZ_GROUP: ColorGroup = {
  id: "viz",
  intro:
    "Three hues for data inside interactive activities, apart from every meaning outside the canvas. Never blue (progress) or violet (Brain Power).",
  title: "Activity visuals",
  tokens: [
    {
      meaning: "The thing the learner moves.",
      name: "viz-accent",
      text: true,
      use: "A slider's point, a moved body.",
    },
    {
      meaning: "A target, a highlight or a prize.",
      name: "viz-highlight",
      text: true,
      use: "A target line, look here inside a chart.",
    },
    {
      meaning: "A second series.",
      name: "viz-secondary",
      text: true,
      use: "The other line or set in a comparison.",
    },
    {
      avoid: "Anything outside a chart: green there would read as right, and progress is blue.",
      meaning: "A chart's fourth series.",
      name: "viz-series-4",
      use: "A chart's fourth bars or line. Lighter than the first three, so it stays apart for color-blind readers.",
    },
    {
      meaning: "A chart's fifth series.",
      name: "viz-series-5",
      use: "A chart's fifth bars or line: a slate, the darkest of the six in light.",
    },
    {
      meaning: "A chart's sixth series.",
      name: "viz-series-6",
      use: "A chart's sixth bars or line. Past six, the colors repeat drawn open: outlined bars, dashed lines with hollow points.",
    },
  ],
};
