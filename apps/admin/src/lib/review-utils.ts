type ReviewGroup = "text" | "image" | "audio";

type ReviewTaskType =
  | "courseSuggestions"
  | "sentenceAudio"
  | "stepImage"
  | "stepSelectImage"
  | "wordAudio";

const REVIEW_TASKS: Record<ReviewTaskType, { group: ReviewGroup; label: string; path: string }> = {
  courseSuggestions: {
    group: "text",
    label: "Course Suggestions",
    path: "/review/text/course-suggestions",
  },
  sentenceAudio: {
    group: "audio",
    label: "Sentence Audio",
    path: "/review/audio/sentence-audio",
  },
  stepImage: {
    group: "image",
    label: "Step Images",
    path: "/review/image/step-image",
  },
  stepSelectImage: {
    group: "image",
    label: "Select Images",
    path: "/review/image/step-select-image",
  },
  wordAudio: {
    group: "audio",
    label: "Word Audio",
    path: "/review/audio/word-audio",
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

const REVIEW_GROUPS: { group: ReviewGroup; label: string }[] = [
  { group: "text", label: "Text" },
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
