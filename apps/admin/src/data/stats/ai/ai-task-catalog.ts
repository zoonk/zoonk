import { formatAiTaskLabel } from "./ai-task-stats";

type AiTaskMetadata = {
  defaultModel: string;
  supportsFallbackReporting: boolean;
};

type AiTaskCatalogGroupDefinition = {
  description: string;
  taskNames: AiTaskName[];
  title: string;
};

const AI_TASK_METADATA = {
  "activity-custom": {
    defaultModel: "google/gemini-3-flash",
    supportsFallbackReporting: true,
  },
  "activity-distractors": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-explanation": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-grammar-content": {
    defaultModel: "google/gemini-3.1-pro-preview",
    supportsFallbackReporting: true,
  },
  "activity-grammar-user-content": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-practice": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-pronunciation": {
    defaultModel: "google/gemini-3-flash",
    supportsFallbackReporting: true,
  },
  "activity-quiz": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-romanization": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-sentences": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "activity-translation": {
    defaultModel: "openai/gpt-5.4-mini",
    supportsFallbackReporting: true,
  },
  "activity-vocabulary": {
    defaultModel: "google/gemini-3-flash",
    supportsFallbackReporting: true,
  },
  "alternative-titles": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "chapter-lessons": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "course-categories": {
    defaultModel: "google/gemini-3.1-flash-lite-preview",
    supportsFallbackReporting: true,
  },
  "course-chapters": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "course-description": {
    defaultModel: "openai/gpt-5.4-nano",
    supportsFallbackReporting: true,
  },
  "course-suggestions": {
    defaultModel: "openai/gpt-5.4-mini",
    supportsFallbackReporting: true,
  },
  "course-thumbnail": {
    defaultModel: "openai/gpt-image-2",
    supportsFallbackReporting: false,
  },
  "language-chapter-lessons": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "language-course-chapters": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "lesson-core-activities": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "lesson-custom-activities": {
    defaultModel: "google/gemini-3-flash",
    supportsFallbackReporting: true,
  },
  "lesson-kind": {
    defaultModel: "openai/gpt-5.4-nano",
    supportsFallbackReporting: true,
  },
  "step-content-image": {
    defaultModel: "openai/gpt-image-2",
    supportsFallbackReporting: false,
  },
  "step-image-prompts": {
    defaultModel: "openai/gpt-5.4",
    supportsFallbackReporting: true,
  },
  "step-select-image": {
    defaultModel: "openai/gpt-image-2",
    supportsFallbackReporting: false,
  },
} satisfies Record<string, AiTaskMetadata>;

export type AiTaskName = keyof typeof AI_TASK_METADATA;

export type AiTaskCatalogTask = {
  defaultModel: string;
  supportsFallbackReporting: boolean;
  taskLabel: string;
  taskName: AiTaskName;
};

type AiTaskCatalogGroup = {
  description: string;
  tasks: AiTaskCatalogTask[];
  title: string;
};

const AI_TASK_CATALOG_GROUP_DEFINITIONS = [
  {
    description: "Top-level course creation, positioning, and presentation tasks.",
    taskNames: [
      "course-suggestions",
      "alternative-titles",
      "course-categories",
      "course-description",
      "course-thumbnail",
      "course-chapters",
      "language-course-chapters",
    ],
    title: "Course Planning",
  },
  {
    description: "Chapter-level planning tasks that decide which lessons should exist next.",
    taskNames: ["chapter-lessons", "language-chapter-lessons"],
    title: "Chapter Planning",
  },
  {
    description:
      "Lesson scaffolding tasks that shape the structure before activity generation starts.",
    taskNames: ["lesson-kind", "lesson-core-activities", "lesson-custom-activities"],
    title: "Lesson Flow",
  },
  {
    description: "Core lesson activities, including explanations, practice, quiz, and custom work.",
    taskNames: ["activity-explanation", "activity-practice", "activity-quiz", "activity-custom"],
    title: "Core Activities",
  },
  {
    description:
      "Language-specific tasks for vocabulary, grammar, pronunciation, and translation work.",
    taskNames: [
      "activity-vocabulary",
      "activity-translation",
      "activity-grammar-content",
      "activity-grammar-user-content",
      "activity-distractors",
      "activity-pronunciation",
      "activity-sentences",
      "activity-romanization",
    ],
    title: "Language Activities",
  },
  {
    description: "Image-selection, step image prompt, and step image generation tasks.",
    taskNames: ["step-select-image", "step-image-prompts", "step-content-image"],
    title: "Step Media",
  },
] satisfies AiTaskCatalogGroupDefinition[];

/**
 * The AI task index now acts as a lightweight directory instead of a live
 * dashboard. This catalog keeps the admin-specific grouping, labels, and
 * configured default models in one place so the fallback summary can reuse the
 * same task definitions as the directory.
 */
export const AI_TASK_CATALOG = AI_TASK_CATALOG_GROUP_DEFINITIONS.map((group) => ({
  description: group.description,
  tasks: group.taskNames.map((taskName) => buildAiTaskCatalogTask({ taskName })),
  title: group.title,
})) satisfies AiTaskCatalogGroup[];

/**
 * The fallback summary needs a flat task list so it can group active tasks by
 * configured default model without caring which section they appear under in the
 * directory UI.
 */
export function listAiTaskCatalogTasks() {
  return AI_TASK_CATALOG.flatMap((group) => group.tasks);
}

/**
 * Building task objects through one helper keeps labels and metadata aligned
 * wherever the admin UI needs to render or analyze a task.
 */
function buildAiTaskCatalogTask({ taskName }: { taskName: AiTaskName }): AiTaskCatalogTask {
  const metadata = AI_TASK_METADATA[taskName];

  return {
    defaultModel: metadata.defaultModel,
    supportsFallbackReporting: metadata.supportsFallbackReporting,
    taskLabel: formatAiTaskLabel(taskName),
    taskName,
  };
}
