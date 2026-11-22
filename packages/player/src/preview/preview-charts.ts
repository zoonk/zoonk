import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { DETECTOR_SCAN_PLOT, FILL_WEIGHT_PLOT } from "@zoonk/testing/fixtures/plot-visuals";
import { type PreviewEntry, entry } from "./preview-entry";
import { explanationStep } from "./preview-steps";
import { japaneseRegionsChart, lawTimeline, lettersChart, visitorsChart } from "./preview-visuals";

const distanceChart: ChartVisual = {
  ...lettersChart,
  categories: ["Monday", "Tuesday", "Wednesday"],
  categoryLabel: "Day",
  series: lettersChart.series.map((series) => ({ ...series, name: "Distance" })),
  title: "Distance traveled",
  unit: "km",
  valueLabel: "Distance",
};

export const chartEntries: PreviewEntry[] = [
  entry({
    group: "Lesson screens",
    id: "explanation-chart",
    label: "Explanation with a chart",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: distanceChart }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-cropped-line",
    label: "Explanation with a cropped line chart",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: visitorsChart }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-wide-names",
    label: "Explanation with a chart of Japanese names",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: japaneseRegionsChart }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-plot",
    label: "Explanation with named points",
    screen: (id) =>
      explanationStep(
        {
          text: "The scan measured five spots along the detector. **C** counts highest, but none reached the target.",
          title: "Look between the points",
          visual: { ...DETECTOR_SCAN_PLOT, references: [{ label: "Target", y: 960 }] },
        },
        { id },
      ),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-limits",
    label: "Explanation with limit lines",
    screen: (id) =>
      explanationStep(
        {
          text: "Each dot is one day's average fill. It stayed near the **500 ml target** for a week, then crossed the **upper limit** on day 8.",
          title: "Drifting past the limit",
          visual: FILL_WEIGHT_PLOT,
        },
        { id },
      ),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-timeline",
    label: "Explanation with a timeline",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: lawTimeline }, { id }),
  }),
];
