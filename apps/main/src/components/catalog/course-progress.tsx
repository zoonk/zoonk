"use client";

import { switchGoal } from "@/app/[lang]/(app)/(learn)/_components/switch-goal";
import { VisitorLook } from "@/components/learner/visitor-look";
import { getStartControlClassName } from "@/components/public/public-start";
import { Link, useRouter } from "@/i18n/navigation";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type LearnerSummaryGoal } from "@zoonk/core/learner/summary/contract";
import { type CourseLevel } from "@zoonk/db/enums";
import { RouteZone } from "@zoonk/learn/route-line";
import { StatusMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { isJsonObject } from "@zoonk/utils/json";
import { ArrowRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  use,
  useEffect,
  useSyncExternalStore,
  useTransition,
} from "react";
import { type CourseProgress } from "./course-progress-contract";
import { ShowMore } from "./show-more";

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

function useCourseGoal(courseId: string): LearnerSummaryGoal | null {
  const learner = useLearnerSummary();

  return learner.status === "ready"
    ? (learner.summary.goals.find((goal) => goal.courseId === courseId) ?? null)
    : null;
}

/**
 * Goes where the plan is, so it never waits on the start page's redirect: its setup while questions
 * are left, or Today, after making the goal the one the tabs show.
 */
export function CourseContinueLink({ courseId }: { courseId: string }) {
  const t = useExtracted();
  const router = useRouter();
  const goal = useCourseGoal(courseId);
  const [isPending, startTransition] = useTransition();

  if (!goal) {
    return null;
  }

  const label = (
    <>
      {t("Continue your plan")}
      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
    </>
  );

  if (goal.isSettingUp || goal.isActive) {
    return (
      <Link
        className={getStartControlClassName()}
        href={goal.isSettingUp ? `/start/${goal.id}` : "/today"}
        prefetch
      >
        {label}
      </Link>
    );
  }

  const continueGoal = () => {
    startTransition(async () => {
      await switchGoal(goal.id);
      router.push("/today");
    });
  };

  return (
    <button
      aria-busy={isPending}
      className={getStartControlClassName()}
      disabled={isPending}
      onClick={continueGoal}
      type="button"
    >
      {label}
    </button>
  );
}

/**
 * Marks the chapter of the next lesson in the learner's plan, or its level while that lesson isn't
 * written into a chapter yet.
 */
export function CourseHere({
  chapterId = null,
  courseId,
  level = null,
}: {
  chapterId?: string | null;
  courseId: string;
  level?: CourseLevel | null;
}) {
  const t = useExtracted();
  const goal = useCourseGoal(courseId);

  const isHere =
    goal !== null &&
    (chapterId
      ? goal.courseChapterId === chapterId
      : goal.courseChapterId === null && goal.courseLevel === level);

  if (!isHere) {
    return null;
  }

  return (
    <span
      className="text-success-text inline-flex flex-none items-center gap-1.5 font-mono text-xs font-normal tabular-nums"
      data-slot="course-here"
    >
      <StatusMark status="next" />
      {t("You are here")}
    </span>
  );
}

/** The example plan's numbers help someone deciding; a learner whose plan follows the course has their own. */
export function CourseExampleNumbers({
  children,
  courseId,
}: {
  children: ReactNode;
  courseId: string;
}) {
  return <CourseGoalSwitch continueLink={null} courseId={courseId} startLinks={children} />;
}

/** Opens on its own when it hides the chapter the learner's plan is at. */
export function CourseChapterFold({
  chapterIds,
  courseId,
  ...fold
}: Omit<ComponentProps<typeof ShowMore>, "open"> & { chapterIds: string[]; courseId: string }) {
  const here = useCourseGoal(courseId)?.courseChapterId;

  return <ShowMore {...fold} open={here ? chapterIds.includes(here) : false} />;
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
  const goal = useCourseGoal(courseId);

  if (learner.status === "ready") {
    return goal ? continueLink : startLinks;
  }

  return (
    <span className={cn("contents", learner.status === "not-loaded" && "signed-in:invisible")}>
      {startLinks}
    </span>
  );
}

/**
 * Opens the level the learner's plan is at, or the first one when no plan follows the course. Until
 * the summary answers, a browser with a session keeps every level closed, so the learner's level
 * opens without another one closing above it.
 */
export function CourseLevelZone({
  children,
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
  const learnerLevel = useCourseGoal(courseId)?.courseLevel;

  if (learner.status === "not-loaded" && isFirst) {
    return (
      <>
        <VisitorLook>
          <RouteZone {...zone} open>
            {children}
          </RouteZone>
        </VisitorLook>

        <div aria-hidden="true" className="signed-in:contents hidden" inert>
          <RouteZone {...zone}>{null}</RouteZone>
        </div>
      </>
    );
  }

  return (
    <RouteZone {...zone} open={learnerLevel ? learnerLevel === level : isFirst}>
      {children}
    </RouteZone>
  );
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
