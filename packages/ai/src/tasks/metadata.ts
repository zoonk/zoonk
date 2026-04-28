type AiTaskModelConfig = {
  defaultModel: string;
  fallbackModels: readonly string[];
};

export const AI_TASK_MODEL_CONFIG = {
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
  "lesson-custom": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["anthropic/claude-opus-4.6", "openai/gpt-5.4"],
  },
  "lesson-distractors": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["google/gemini-3.1-flash-lite-preview", "anthropic/claude-sonnet-4.6"],
  },
  "lesson-explanation": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "lesson-grammar-content": {
    defaultModel: "google/gemini-3.1-pro-preview",
    fallbackModels: ["openai/gpt-5.4", "anthropic/claude-opus-4.6"],
  },
  "lesson-grammar-user-content": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3-flash"],
  },
  "lesson-practice": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "lesson-pronunciation": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["anthropic/claude-sonnet-4.6", "openai/gpt-5.1-instant"],
  },
  "lesson-quiz": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6"],
  },
  "lesson-romanization": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"],
  },
  "lesson-sentences": {
    defaultModel: "openai/gpt-5.4",
    fallbackModels: ["google/gemini-3.1-pro-preview", "anthropic/claude-opus-4.6"],
  },
  "lesson-translation": {
    defaultModel: "openai/gpt-5.4-mini",
    fallbackModels: ["google/gemini-3-flash", "anthropic/claude-opus-4.6"],
  },
  "lesson-vocabulary": {
    defaultModel: "google/gemini-3-flash",
    fallbackModels: ["google/gemini-3.1-pro-preview", "openai/gpt-5.4"],
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
