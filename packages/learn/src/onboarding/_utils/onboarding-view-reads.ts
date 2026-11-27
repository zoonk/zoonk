import { type ExamTarget } from "../steps/question-steps";

export function readKnownSubjects(details: Record<string, unknown>): string[] {
  const known = details.knownSubjects;
  return Array.isArray(known) ? known.filter((name) => typeof name === "string") : [];
}

const EXAM_TARGETS: readonly ExamTarget[] = ["admission", "position", "score"];

export function getExamTarget(details: Record<string, unknown>): ExamTarget {
  return EXAM_TARGETS.find((target) => target === details.examTarget) ?? "admission";
}
