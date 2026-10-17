"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, createContext, use, useEffect, useSyncExternalStore } from "react";
import { type CourseProgress } from "./course-progress-contract";
import {
  getCourseProgress,
  readCourseProgress,
  subscribeToCourseProgress,
} from "./course-progress-reads";

/** The page's course and its one lesson question (the lesson's own, or "Try a lesson"'s). */
type ProgressScope = { courseId: string; lessonId: string | null };

/** The current learner's key for the page's answer, or null for a visitor or while unknown. */
const ProgressKeyContext = createContext<string | null>(null);

function getProgressUrl({ courseId, lessonId }: ProgressScope): string {
  const path = `/api/learner/courses/${encodeURIComponent(courseId)}/progress`;
  return lessonId ? `${path}?lesson=${encodeURIComponent(lessonId)}` : path;
}

/** The page's answer for the current learner: null (the visitor's version) until it's read. */
function useCourseProgress(): CourseProgress | null {
  const key = use(ProgressKeyContext);

  return useSyncExternalStore(
    subscribeToCourseProgress,
    () => getCourseProgress(key),
    () => null,
  );
}

/**
 * The learner's own bits of a static catalog page, read in the browser for the switches inside it:
 * whether a goal of theirs follows the course and whether they're partway through the page's one
 * question's lesson. Null (the visitor's version) on the server, while hydrating and until the read
 * answers, and always for a visitor. It's read once the learner summary knows who it's for, and
 * again each time the page shows (the router keeps a page it left, hidden, and shows it again on a
 * return), once per show for the whole page. Keyed by the learner and their sign-in, so one
 * learner's answer never shows for another.
 */
export function CourseProgressScope({
  children,
  courseId,
  lessonId,
}: ProgressScope & { children: ReactNode }) {
  const learner = useLearnerSummary();
  const identity = learner.status === "ready" ? learner.summary.identity : null;
  const url = getProgressUrl({ courseId, lessonId });
  const key = identity ? `${identity.userId} ${identity.signedInAt} ${url}` : null;

  useEffect(() => {
    if (key) {
      void readCourseProgress({ key, url });
    }
  }, [key, url]);

  return <ProgressKeyContext value={key}>{children}</ProgressKeyContext>;
}

/** "Continue your plan" for a learner whose goal follows the course; "Build my plan" otherwise. */
export function CourseGoalSwitch({
  continueLink,
  startLinks,
}: {
  continueLink: ReactNode;
  startLinks: ReactNode;
}) {
  return useCourseProgress()?.followsCourse ? continueLink : startLinks;
}

/** One of the question's two versions, in the one place both take. */
const LESSON_VERSION_CLASS = "col-start-1 row-start-1 flex min-w-0 flex-col";

/**
 * "Continue the lesson" for a learner partway through it; its first question otherwise. The HTML
 * has the question, and "Continue the lesson" takes its place, in the room the question holds, once
 * the browser reads the learner: the card and everything under it stay where they were.
 */
export function LessonProgressSwitch({
  continueLesson,
  question,
}: {
  continueLesson: ReactNode;
  question: ReactNode;
}) {
  const started = useCourseProgress()?.lessonStarted ?? false;

  return (
    <div className="grid">
      <div className={cn(LESSON_VERSION_CLASS, started && "invisible")} inert={started}>
        {question}
      </div>

      {started && <div className={LESSON_VERSION_CLASS}>{continueLesson}</div>}
    </div>
  );
}
