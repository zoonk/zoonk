import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { type ExamTarget } from "../steps/question-steps";

export function getSubject(view: OnboardingView): string {
  const subject = view.goal.details.subject;
  return typeof subject === "string" && subject.trim() ? subject : view.goal.displayName;
}

export function getNativeLanguage(view: OnboardingView): string {
  const native = view.goal.details.nativeLanguage;
  return typeof native === "string" && native.trim() ? native : view.goal.language;
}

export function readKnownSubjects(details: Record<string, unknown>): string[] {
  const known = details.knownSubjects;
  return Array.isArray(known) ? known.filter((name) => typeof name === "string") : [];
}

const EXAM_TARGETS: readonly ExamTarget[] = ["admission", "position", "score"];

export function getExamTarget(details: Record<string, unknown>): ExamTarget {
  return EXAM_TARGETS.find((target) => target === details.examTarget) ?? "admission";
}
