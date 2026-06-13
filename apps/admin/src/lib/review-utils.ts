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
  sentenceAudio: { group: "audio", label: "Sentence Audio", path: "/review/audio/sentence-audio" },
  stepImage: { group: "image", label: "Step Images", path: "/review/image/step-image" },
  stepSelectImage: {
    group: "image",
    label: "Select Images",
    path: "/review/image/step-select-image",
  },
  wordAudio: { group: "audio", label: "Word Audio", path: "/review/audio/word-audio" },
};

function fromKebabCase(str: string): string {
  return str.replaceAll(/-[a-z]/gu, (part) => part.slice(1).toUpperCase());
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

/**
 * URLSearchParams only accepts complete string pairs. Review queue links build
 * their params from optional filters, so this keeps the final constructor input
 * narrow without mutating an array as each optional value is discovered.
 */
function isReviewQueueParam(entry: [string, string] | undefined): entry is [string, string] {
  return Array.isArray(entry);
}

/**
 * Review actions redirect to the next item after each decision. Building that
 * queue URL in one place keeps route filters such as `lessonSlug` attached
 * without duplicating query-string rules across every action.
 */
function getReviewQueuePath({
  currentId,
  lessonSlug,
  taskType,
}: {
  currentId?: string | null;
  lessonSlug?: string | null;
  taskType: ReviewTaskType;
}) {
  const queueParams: ([string, string] | undefined)[] = [
    lessonSlug ? ["lessonSlug", lessonSlug] : undefined,
    currentId ? ["current", currentId] : undefined,
  ];

  const params = new URLSearchParams(queueParams.filter((entry) => isReviewQueueParam(entry)));
  const queryString = params.toString();
  const taskPath = getTaskPath(taskType);

  return queryString ? `${taskPath}?${queryString}` : taskPath;
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
  getReviewQueuePath,
  getTasksByGroup,
  isValidTaskType,
  resolveTaskType,
};
export type { ReviewTaskType };
