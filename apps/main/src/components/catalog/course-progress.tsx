"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type CourseLevel } from "@zoonk/db/enums";
import { RouteZone } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { isJsonObject } from "@zoonk/utils/json";
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  use,
  useEffect,
  useSyncExternalStore,
} from "react";
import { type CourseProgress } from "./course-progress-contract";

type ProgressScope = { courseId: string; lessonId: string | null };

const ProgressKeyContext = createContext<string | null>(null);

/** Held for the tab's life, so a page shown again starts from what it showed last while it reads again. */
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
  return isJsonObject(body) && typeof body.lessonStarted === "boolean"
    ? { lessonStarted: body.lessonStarted }
    : null;
}

/** A read asked for while the same one is out runs again once it settles, so a page shown again gets a fresh answer. */
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

function useCourseProgress(): CourseProgress | null {
  const key = use(ProgressKeyContext);

  return useSyncExternalStore(
    subscribe,
    () => (key ? (progressByKey.get(key) ?? null) : null),
    () => null,
  );
}

/**
 * Read again each time the page shows, since the router keeps a page it left. Keyed by the learner and
 * their sign-in, so one learner's answer never shows for another.
 */
export function CourseProgressScope({
  children,
  courseId,
  lessonId,
}: ProgressScope & { children: ReactNode }) {
  const learner = useLearnerSummary();
  const identity = learner.status === "ready" ? learner.summary.identity : null;
  const url = getProgressUrl({ courseId, lessonId });
  const key = identity && lessonId ? `${identity.userId} ${identity.signedInAt} ${url}` : null;

  useEffect(() => {
    if (key) {
      void readProgress({ key, url });
    }
  }, [key, url]);

  return <ProgressKeyContext value={key}>{children}</ProgressKeyContext>;
}

/**
 * Until the summary answers, a browser whose session hint says it holds a session keeps the start
 * out of sight in its own room, so a learner never sees "Build my plan" turn into "Continue your plan".
 */
export function CourseGoalSwitch({
  continueLink,
  courseId,
  startLinks,
}: {
  continueLink: ReactNode;
  courseId: string;
  startLinks: ReactNode;
}) {
  const learner = useLearnerSummary();

  if (learner.status === "ready") {
    return learner.summary.goals.some((goal) => goal.courseId === courseId)
      ? continueLink
      : startLinks;
  }

  return (
    <span className={cn("contents", learner.status === "not-loaded" && "signed-in:invisible")}>
      {startLinks}
    </span>
  );
}

/** Opens the level the learner's plan is at, or the first one when no plan follows the course. */
export function CourseLevelZone({
  courseId,
  isFirst,
  level,
  ...zone
}: Omit<ComponentProps<typeof RouteZone>, "open"> & {
  courseId: string;
  isFirst: boolean;
  level: CourseLevel;
}) {
  const learner = useLearnerSummary();

  const learnerLevel =
    learner.status === "ready"
      ? learner.summary.goals.find((goal) => goal.courseId === courseId)?.courseLevel
      : null;

  return <RouteZone {...zone} open={learnerLevel ? learnerLevel === level : isFirst} />;
}

const LESSON_VERSION_CLASS = "col-start-1 row-start-1 flex min-w-0 flex-col";

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
