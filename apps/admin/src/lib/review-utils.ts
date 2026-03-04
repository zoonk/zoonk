type ReviewGroup = "text" | "visual" | "image" | "audio";

const REVIEW_TASKS = {
  courseSuggestions: {
    group: "text",
    label: "Course Suggestions",
    path: "/review/text/course-suggestions",
  },
  stepVisual: {
    group: "visual",
    label: "Step Visuals",
    path: "/review/visual/step-visual",
  },
  stepVisualImage: {
    group: "image",
    label: "Step Visual Images",
    path: "/review/image/step-visual-image",
  },
  wordAudio: {
    group: "audio",
    label: "Word Audio",
    path: "/review/audio/word-audio",
  },
} as const satisfies Record<
  string,
  {
    group: ReviewGroup;
    label: string;
    path: string;
  }
>;

type ReviewTaskType = keyof typeof REVIEW_TASKS;

const REVIEW_TASK_TYPES: ReviewTaskType[] = [
  "courseSuggestions",
  "stepVisual",
  "stepVisualImage",
  "wordAudio",
];

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

function fromKebabCase(str: string): string {
  return str.replaceAll(/-([a-z])/g, (_, char: string) => char.toUpperCase());
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

const REVIEW_GROUPS: { group: ReviewGroup; label: string }[] = [
  { group: "text", label: "Text" },
  { group: "visual", label: "Visual" },
  { group: "image", label: "Image" },
  { group: "audio", label: "Audio" },
];

export {
  REVIEW_GROUPS,
  REVIEW_TASK_TYPES,
  getTaskLabel,
  getTaskPath,
  getTasksByGroup,
  isValidTaskType,
  resolveTaskType,
};
export type { ReviewTaskType };
