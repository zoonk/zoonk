import { AI_TASK_MODEL_CONFIG, type AiTaskName } from "@zoonk/core/ai";
import { formatAiTaskLabel } from "./ai-task-stats";

type AiTaskCatalogGroupDefinition = {
  description: string;
  taskNames: AiTaskName[];
  title: string;
};

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
    taskNames: ["chapter-lessons", "lesson-kind", "language-chapter-lessons"],
    title: "Chapter Planning",
  },
  {
    description: "Lesson content tasks for explanations, practice, quiz, and tutorial work.",
    taskNames: ["lesson-explanation", "lesson-practice", "lesson-quiz", "lesson-tutorial"],
    title: "Lesson Content",
  },
  {
    description:
      "Language lesson tasks for vocabulary, grammar, pronunciation, and translation work.",
    taskNames: [
      "lesson-vocabulary",
      "lesson-translation",
      "lesson-grammar-content",
      "lesson-grammar-user-content",
      "lesson-distractors",
      "lesson-pronunciation",
      "lesson-sentences",
      "lesson-romanization",
    ],
    title: "Language Content",
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
  const metadata = AI_TASK_MODEL_CONFIG[taskName];

  return {
    defaultModel: metadata.defaultModel,
    supportsFallbackReporting: metadata.fallbackModels.length > 0,
    taskLabel: formatAiTaskLabel(taskName),
    taskName,
  };
}
