import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { DETECTOR_SCAN_PLOT, FILL_WEIGHT_PLOT } from "@zoonk/testing/fixtures/plot-visuals";
import { type PreviewEntry, entry } from "./preview-entry";
import { explanationStep, lawTimeline, lettersChart } from "./preview-steps";

export const chartEntries: PreviewEntry[] = [
  entry({
    group: "Lesson screens",
    id: "explanation-chart",
    label: "Explanation with a chart",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: lettersChart }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-plot",
    label: "Explanation with named points",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: DETECTOR_SCAN_PLOT }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-limits",
    label: "Explanation with limit lines",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: FILL_WEIGHT_PLOT }, { id }),
  }),
  entry({
    group: "Lesson screens",
    id: "explanation-timeline",
    label: "Explanation with a timeline",
    screen: (id) =>
      explanationStep({ ...playableStepContent.explanation, visual: lawTimeline }, { id }),
  }),
];
