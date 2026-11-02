import { type GenerationFailure, type GenerationWorkflow } from "@/data/ai/get-generation-failures";
import { type ProvenanceTable } from "@/data/ai/list-provenance-counts";

export const provenanceTableLabels: Record<ProvenanceTable, string> = {
  answerExplanations: "Answer explanations",
  chapters: "Chapters",
  items: "Items",
  lessons: "Lessons",
  mediaAssets: "Media assets",
  memoryFacts: "Memory facts",
  planChanges: "Plan changes",
  skills: "Skills",
  sourceChangeNotices: "Source change notices",
  stepVariants: "Step variants",
  steps: "Steps",
};

export const generationWorkflowLabels: Record<GenerationWorkflow, string> = {
  chapterOutline: "Chapter outline",
  courseOutline: "Course outline",
  lessonContent: "Lesson content",
  lessonQuestion: "Lesson question",
  lessonSpec: "Lesson spec",
};

type FailureHrefBuilder = (failure: GenerationFailure) => string | null;

function toParentCourseHref(failure: GenerationFailure): string | null {
  return failure.parentId ? `/courses/${failure.parentId}` : null;
}

/** Chapters have no admin page, so their failures link to the course they belong to. */
const failureHrefBuilders: Record<GenerationWorkflow, FailureHrefBuilder> = {
  chapterOutline: toParentCourseHref,
  courseOutline: (failure) => `/courses/${failure.id}`,
  lessonContent: (failure) => `/lessons/${failure.id}`,
  lessonQuestion: (failure) => `/questions/${failure.id}`,
  lessonSpec: (failure) => `/lessons/${failure.id}`,
};

export function getGenerationFailureHref(failure: GenerationFailure): string | null {
  return failureHrefBuilders[failure.workflow](failure);
}
