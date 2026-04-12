export const REGULAR_COURSE_ESTIMATE_NOTE =
  "Assumes the course suggestion already exists and estimates the full curriculum, not only the first generated chapter.";

export const COURSE_INPUT_ESTIMATE_NOTE =
  "Course totals use the lesson and chapter counts entered on this page instead of relying on completed-course history.";

export const LANGUAGE_TTS_ESTIMATE_NOTE =
  "TTS is inferred from newly created word and sentence audio assets because Gateway does not report those calls.";

export const LANGUAGE_TTS_HEURISTIC_NOTE =
  "Audio cost assumes Gemini TTS pricing for all clips, about 70 words per 100 text tokens, 32 audio tokens per second, and a 0.75s minimum for single-word clips.";

export const VISUAL_TASK_BY_KIND = {
  chart: "visual-chart",
  code: "visual-code",
  diagram: "visual-diagram",
  formula: "visual-formula",
  image: "step-visual-image",
  music: "visual-music",
  quote: "visual-quote",
  table: "visual-table",
  timeline: "visual-timeline",
} as const satisfies Record<string, string>;

export const LANGUAGE_GATEWAY_TASKS = [
  "activity-vocabulary",
  "activity-distractors",
  "activity-pronunciation",
  "activity-romanization",
  "activity-translation",
  "activity-sentences",
  "activity-grammar-content",
  "activity-grammar-user-content",
] as const;
