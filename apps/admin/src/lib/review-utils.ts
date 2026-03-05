import { type StepVisualKind } from "@zoonk/db";

type ReviewGroup = "text" | "image";

type ReviewTaskType = "courseSuggestions" | "stepVisualImage" | "stepSelectImage";

const REVIEW_TASKS: Record<ReviewTaskType, { group: ReviewGroup; label: string; path: string }> = {
  courseSuggestions: {
    group: "text",
    label: "Course Suggestions",
    path: "/review/text/course-suggestions",
  },
  stepSelectImage: {
    group: "image",
    label: "Select Images",
    path: "/review/image/step-select-image",
  },
  stepVisualImage: {
    group: "image",
    label: "Visual Images",
    path: "/review/image/step-visual-image",
  },
};

function fromKebabCase(str: string): string {
  return str.replaceAll(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- keys mirror ReviewTaskType by construction
const REVIEW_TASK_TYPES = Object.keys(REVIEW_TASKS) as ReviewTaskType[];

function isValidTaskType(value: string): value is ReviewTaskType {
  return (REVIEW_TASK_TYPES as readonly string[]).includes(value);
}

function getTaskLabel(taskType: ReviewTaskType): string {
  return REVIEW_TASKS[taskType].label;
}

function getTaskGroup(taskType: ReviewTaskType): ReviewGroup {
  return REVIEW_TASKS[taskType].group;
}

function getTaskPath(taskType: ReviewTaskType) {
  return REVIEW_TASKS[taskType].path;
}

function resolveTaskType(group: string, task: string): ReviewTaskType | null {
  const taskType = fromKebabCase(task);

  if (!isValidTaskType(taskType)) {
    return null;
  }
  if (getTaskGroup(taskType) !== group) {
    return null;
  }

  return taskType;
}

function getTasksByGroup(group: ReviewGroup): ReviewTaskType[] {
  return REVIEW_TASK_TYPES.filter((taskType) => REVIEW_TASKS[taskType].group === group);
}

const VISUAL_KINDS: readonly StepVisualKind[] = [
  "code",
  "image",
  "table",
  "chart",
  "diagram",
  "timeline",
  "quote",
  "audio",
  "video",
];

const VISUAL_KIND_SET: ReadonlySet<string> = new Set(VISUAL_KINDS);

function isVisualKind(value: string): value is StepVisualKind {
  return VISUAL_KIND_SET.has(value);
}

function getVisualKindFromTaskType(taskType: string): StepVisualKind | null {
  const match = taskType.match(/^stepVisual(.+)$/);
  if (!match?.[1]) {
    return null;
  }

  const kind = match[1].toLowerCase();
  return isVisualKind(kind) ? kind : null;
}

const REVIEW_GROUPS: { group: ReviewGroup; label: string }[] = [
  { group: "text", label: "Text" },
  { group: "image", label: "Image" },
];

export {
  REVIEW_GROUPS,
  REVIEW_TASK_TYPES,
  getTaskLabel,
  getTaskPath,
  getTasksByGroup,
  getVisualKindFromTaskType,
  isValidTaskType,
  resolveTaskType,
};
export type { ReviewTaskType };
