export const REGULAR_COURSE_ESTIMATE_NOTE =
  "Assumes the course suggestion already exists and estimates the full curriculum, not only the first generated chapter.";

export const COURSE_INPUT_ESTIMATE_NOTE =
  "Course totals use the lesson and chapter counts entered on this page instead of relying on completed-course history.";

export const LANGUAGE_TTS_ESTIMATE_NOTE =
  "TTS is inferred from newly created word and sentence audio assets because Gateway does not report those calls.";

export const LANGUAGE_TTS_HEURISTIC_NOTE =
  "Audio cost assumes Gemini TTS pricing for all clips, about 70 words per 100 text tokens, 32 audio tokens per second, and a 0.75s minimum for single-word clips.";

export const STEP_CONTENT_IMAGE_TASK = "step-content-image" as const;
export const STEP_IMAGE_PROMPTS_TASK = "step-image-prompts" as const;
export const STEP_SELECT_IMAGE_TASK = "step-select-image" as const;

export const LANGUAGE_GATEWAY_TASKS = [
  "lesson-vocabulary",
  "lesson-distractors",
  "lesson-pronunciation",
  "lesson-romanization",
  "lesson-translation",
  "lesson-sentences",
  "lesson-grammar-content",
  "lesson-grammar-user-content",
] as const;
