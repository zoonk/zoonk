type AiTaskModelConfig = {
  defaultModel: string;
  fallbackModels: readonly string[];
};

export const AI_TASK_MODEL_CONFIG = {
  "activity-custom": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["anthropic/claude-opus-4.6", "openai/gpt-5.4"],
  },
  "activity-distractors": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["google/gemini-3.1-flash-lite-preview", "anthropic/claude-sonnet-4.6"],
  },
  "activity-explanation": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "activity-grammar-content": {
    defaultModel: "google/gemini-3.1-pro-preview",
    fallbackModels: ["openai/gpt-5.4", "anthropic/claude-opus-4.6"],
  },
  "activity-grammar-user-content": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3-flash"],
  },
  "activity-practice": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "activity-pronunciation": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["anthropic/claude-sonnet-4.6", "openai/gpt-5.1-instant"],
  },
  "activity-quiz": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6"],
  },
  "activity-romanization": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "activity-sentences": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["google/gemini-3.1-pro-preview", "anthropic/claude-opus-4.6"],
  },
  "activity-translation": {
    defaultModel: "openai/gpt-5.4-mini",
    fallbackModels: ["google/gemini-3-flash", "anthropic/claude-opus-4.6"],
  },
  "activity-vocabulary": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["google/gemini-3.1-pro-preview", "openai/gpt-5.4"],
  },
  "alternative-titles": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "chapter-lessons": {
    defaultModel: "openai/gpt-5.5",
    fallbackModels: [
      "openai/gpt-5.4",
      "google/gemini-3.1-pro-preview",
      "anthropic/claude-opus-4.7",
    ],
  },
  "course-categories": {
    defaultModel: "google/gemini-3.1-flash-lite-preview",
    fallbackModels: ["openai/gpt-5.4-nano", "anthropic/claude-haiku-4.5", "meta/llama-4-scout"],
  },
  "course-chapters": {
    defaultModel: "openai/gpt-5.5",
    fallbackModels: [
      "openai/gpt-5.4",
      "anthropic/claude-opus-4.7",
      "google/gemini-3.1-pro-preview",
    ],
  },
  "course-description": {
    defaultModel: "openai/gpt-5.4-nano",
    fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
  },
  "course-suggestions": {
    defaultModel: "openai/gpt-5.4-mini",
    fallbackModels: ["google/gemini-3-flash"],
  },
  "course-thumbnail": {
    defaultModel: "openai/gpt-image-2",
    fallbackModels: [],
  },
  "language-chapter-lessons": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["google/gemini-3.1-pro-preview", "anthropic/claude-sonnet-4.6"],
  },
  "language-course-chapters": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["google/gemini-3.1-pro-preview", "anthropic/claude-sonnet-4.6"],
  },
  "lesson-core-activities": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.7", "google/gemini-3.1-pro-preview"],
  },
  "lesson-custom-activities": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["anthropic/claude-opus-4.6", "openai/gpt-5.4"],
  },
  "lesson-kind": {
    defaultModel: "openai/gpt-5.4-nano",
    fallbackModels: [
      "google/gemini-3.1-flash-lite-preview",
      "meta/llama-4-scout",
      "anthropic/claude-haiku-4.5",
    ],
  },
  "step-content-image": {
    defaultModel: "openai/gpt-image-2",
    fallbackModels: [],
  },
  "step-image-prompts": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "step-select-image": {
    defaultModel: "openai/gpt-image-2",
    fallbackModels: [],
  },
} satisfies Record<string, AiTaskModelConfig>;

export type AiTaskName = keyof typeof AI_TASK_MODEL_CONFIG;
