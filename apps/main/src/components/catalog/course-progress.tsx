"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { isJsonObject } from "@zoonk/utils/json";
import { type ReactNode, createContext, use, useEffect, useSyncExternalStore } from "react";
import { type CourseProgress } from "./course-progress-contract";

/** The page's course and its one lesson question (the lesson's own, or "Try a lesson"'s). */
type ProgressScope = { courseId: string; lessonId: string | null };

/** The current learner's key for the page's answer, or null for a visitor or while unknown. */
const ProgressKeyContext = createContext<string | null>(null);

/**
 * Answers by learner and address, held for the tab's life: a page shown again starts from what it
 * showed last while it reads again.
 */
const progressByKey = new Map<string, CourseProgress>();
const pendingKeys = new Set<string>();

/** A page shown again while its earlier read was out: one fresh read follows that one. */
const rereadKeys = new Set<string>();

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getProgressUrl({ courseId, lessonId }: ProgressScope): string {
  const path = `/api/learner/courses/${encodeURIComponent(courseId)}/progress`;
  return lessonId ? `${path}?lesson=${encodeURIComponent(lessonId)}` : path;
}

function toProgress(body: unknown): CourseProgress | null {
  return isJsonObject(body) &&
    typeof body.followsCourse === "boolean" &&
    typeof body.lessonStarted === "boolean"
    ? { followsCourse: body.followsCourse, lessonStarted: body.lessonStarted }
    : null;
}

/**
 * A failed read keeps what the page shows (the visitor's version, or the last answer). A read asked
 * for while the same one is out runs again once it settles, so a page shown again gets an answer
 * read after its show, not one from before it.
 */
async function readProgress({ key, url }: { key: string; url: string }): Promise<void> {
  if (pendingKeys.has(key)) {
    rereadKeys.add(key);
    return;
  }

  pendingKeys.add(key);

  const progress = await fetch(url, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then(toProgress, () => null);

  pendingKeys.delete(key);

  if (progress) {
    progressByKey.set(key, progress);
    listeners.forEach((listener) => listener());
  }

  if (rereadKeys.delete(key)) {
    void readProgress({ key, url });
  }
}

/** The page's answer for the current learner: null (the visitor's version) until it's read. */
function useCourseProgress(): CourseProgress | null {
  const key = use(ProgressKeyContext);

  return useSyncExternalStore(
    subscribe,
    () => (key ? (progressByKey.get(key) ?? null) : null),
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
      void readProgress({ key, url });
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

/** "Continue the lesson" for a learner partway through it; its first question otherwise. */
export function LessonProgressSwitch({
  continueLesson,
  question,
}: {
  continueLesson: ReactNode;
  question: ReactNode;
}) {
  return useCourseProgress()?.lessonStarted ? continueLesson : question;
}
