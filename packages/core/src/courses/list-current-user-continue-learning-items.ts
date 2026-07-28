import "server-only";
import { type Chapter, type Course, type LessonKind, type Organization } from "@zoonk/db";
import { cacheTag } from "next/cache";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLessonVisibilityCacheTag,
  getUserProgressCacheTag,
} from "../cache/tags";
import { type NextLessonInCourse } from "../lessons/get-next-lesson-in-course";
import { getSession } from "../users/get-session";
import { getLessonVisibility } from "../users/lesson-visibility";
import {
  type ContinueLearningCandidate,
  listContinueLearningCandidates,
} from "./_utils/continue-learning-candidates";
import { type ContinueLearningState } from "./_utils/continue-learning-next-state";
import {
  type ContinueLearningRow,
  listRecentContinueLearningRows,
} from "./_utils/continue-learning-queries";
import { MAX_CONTINUE_LEARNING_ITEMS } from "./continue-learning-contract";

type ContinueLearningResolvedState = NonNullable<ContinueLearningState>;

type PrefetchableContinueLearningState = ContinueLearningResolvedState & {
  lessonId: string;
  lessonKind: NonNullable<ContinueLearningResolvedState["lessonKind"]>;
};

type ContinueLearningLesson = {
  description: string | null;
  id: string;
  kind: LessonKind;
  position: number;
  slug: string;
  title: string | null;
};

type ContinueLearningPendingLesson = Pick<
  ContinueLearningLesson,
  "description" | "id" | "kind" | "slug" | "title"
>;

type ContinueLearningChapter = Pick<Chapter, "id" | "slug" | "title">;

type ContinueLearningCourse = Pick<Course, "id" | "slug" | "title" | "imageUrl"> & {
  organization: Pick<Organization, "slug"> | null;
};

type ContinueLearningReadyItem = {
  status: "ready";
  lesson: ContinueLearningLesson;
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
};

type ContinueLearningPendingItem = {
  status: "pending";
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
  lesson: ContinueLearningPendingLesson | null;
};

export type ContinueLearningItem = ContinueLearningPendingItem | ContinueLearningReadyItem;

type ContinueLearningListOptions = { requireAuthentication: true };

/**
 * The feed only shows lightweight course metadata, so this helper converts the
 * SQL row into the nested course shape once and keeps the rest of the item
 * builders free from row field naming details.
 */
function toCourse(row: ContinueLearningRow): ContinueLearningCourse {
  return {
    id: row.courseId,
    imageUrl: row.courseImageUrl,
    organization: row.orgSlug ? { slug: row.orgSlug } : null,
    slug: row.courseSlug,
    title: row.courseTitle,
  };
}

/**
 * When the shared next-state already points at a current lesson, the feed can
 * rebuild the card directly from that state without any extra course-specific
 * navigation logic.
 */
function toReadyItemFromState({
  row,
  state,
}: {
  row: ContinueLearningRow;
  state: PrefetchableContinueLearningState;
}): ContinueLearningReadyItem {
  return {
    chapter: { id: state.chapterId, slug: state.chapterSlug, title: state.chapterTitle },
    course: toCourse(row),
    lesson: {
      description: state.lessonDescription,
      id: state.lessonId,
      kind: state.lessonKind,
      position: state.lessonPosition,
      slug: state.lessonSlug,
      title: state.lessonTitle,
    },
    status: "ready",
  };
}

/**
 * The feed prefers the natural sequential next lesson whenever that target
 * still belongs to an open chapter in the current course tree.
 */
function toReadyItemFromNext({
  next,
  row,
}: {
  next: NextLessonInCourse;
  row: ContinueLearningRow;
}): ContinueLearningReadyItem {
  return {
    chapter: { id: next.chapterId, slug: next.chapterSlug, title: next.chapterTitle },
    course: toCourse(row),
    lesson: {
      description: next.lessonDescription,
      id: next.lessonId,
      kind: next.lessonKind,
      position: next.lessonPosition,
      slug: next.lessonSlug,
      title: next.lessonTitle,
    },
    status: "ready",
  };
}

/**
 * Keeps a sequential lesson visible while its generated player content is not
 * ready, allowing clients to link to the same target without prefetching it.
 */
function toPendingItemFromNext({
  next,
  row,
}: {
  next: NextLessonInCourse;
  row: ContinueLearningRow;
}): ContinueLearningPendingItem {
  return toPendingItem({
    chapter: { id: next.chapterId, slug: next.chapterSlug, title: next.chapterTitle },
    course: toCourse(row),
    lesson: {
      description: next.lessonDescription,
      id: next.lessonId,
      kind: next.lessonKind,
      slug: next.lessonSlug,
      title: next.lessonTitle,
    },
  });
}

/**
 * A completed course should disappear from the feed entirely, even if the
 * learner's last historical completion in that course is still recent.
 */
function shouldHideCandidate({ state }: { state: ContinueLearningResolvedState }) {
  return state.scopeDurablyCompleted;
}

/**
 * Some states are best rendered as pending lesson or chapter targets instead of
 * ready player links. Keeping that card shape in one helper avoids rebuilding
 * the pending payload inline inside the main item-selection branch.
 */
function toPendingItem({
  chapter,
  course,
  lesson,
}: {
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
  lesson: ContinueLearningPendingLesson | null;
}): ContinueLearningPendingItem {
  return { chapter, course, lesson, status: "pending" };
}

/**
 * When the next actionable state has no ready lesson yet, the feed should
 * still point at the current lesson player so the learner can see that work is
 * pending or continue once generation finishes.
 */
function toPendingItemFromState({
  row,
  state,
}: {
  row: ContinueLearningRow;
  state: ContinueLearningResolvedState;
}): ContinueLearningPendingItem {
  return toPendingItem({
    chapter: { id: state.chapterId, slug: state.chapterSlug, title: state.chapterTitle },
    course: toCourse(row),
    lesson: {
      description: state.lessonDescription,
      id: state.lessonId,
      kind: state.lessonKind,
      slug: state.lessonSlug,
      title: state.lessonTitle,
    },
  });
}

/**
 * A completed shared next-state only becomes a useful pending card when the
 * candidate loader already found a next lesson or chapter target to point at.
 */
function toPendingItemFromTarget({
  course,
  pendingTarget,
}: {
  course: ContinueLearningCourse;
  pendingTarget: NonNullable<ContinueLearningCandidate["pendingTarget"]>;
}): ContinueLearningPendingItem {
  return toPendingItem({ chapter: pendingTarget.chapter, course, lesson: pendingTarget.lesson });
}

/**
 * The shared next-state only produces a ready lesson card when it can
 * deep-link into a real current lesson. Making that guard explicit keeps the
 * item-selection branch honest about when those fields are actually present.
 */
function hasPrefetchableLesson(
  state: ContinueLearningResolvedState,
): state is PrefetchableContinueLearningState {
  return Boolean(state.canPrefetch && state.lessonId && state.lessonKind);
}

/**
 * Continue-learning always chooses exactly one card shape per course anchor:
 * sequential lesson, pending fallback target, current lesson from the
 * shared state, or a pending lesson target. Returning null here means the course
 * should not appear in the feed at all.
 */
function toContinueLearningItem({
  candidate,
}: {
  candidate: ContinueLearningCandidate;
}): ContinueLearningItem | null {
  const state = candidate.state;

  if (!state || shouldHideCandidate({ state })) {
    return null;
  }

  const course = toCourse(candidate.row);

  if (candidate.sequentialNext && !candidate.isSequentialNextBlocked) {
    if (candidate.sequentialNext.lessonGenerationStatus !== "completed") {
      return toPendingItemFromNext({ next: candidate.sequentialNext, row: candidate.row });
    }

    return toReadyItemFromNext({ next: candidate.sequentialNext, row: candidate.row });
  }

  if (state.completed) {
    return candidate.pendingTarget
      ? toPendingItemFromTarget({ course, pendingTarget: candidate.pendingTarget })
      : null;
  }

  if (hasPrefetchableLesson(state)) {
    return toReadyItemFromState({ row: candidate.row, state });
  }

  return toPendingItemFromState({ row: candidate.row, state });
}

/**
 * Continue-learning reads like a pipeline: fetch recent course anchors, enrich
 * them with current navigation state, and convert them into the home feed cards.
 * Each identity-dependent query derives the learner from the trusted session
 * source rather than accepting a caller-provided user id.
 */
async function loadContinueLearning(): Promise<{
  candidateCourseIds: string[];
  items: ContinueLearningItem[];
  userId: string | null;
}> {
  const [session, { hiddenLessonKinds }] = await Promise.all([getSession(), getLessonVisibility()]);

  if (!session) {
    return { candidateCourseIds: [], items: [], userId: null };
  }

  const rows = await listRecentContinueLearningRows({
    excludedLessonKinds: hiddenLessonKinds,
    userId: session.user.id,
  });

  if (rows.length === 0) {
    return { candidateCourseIds: [], items: [], userId: session.user.id };
  }

  const candidates = await listContinueLearningCandidates({
    excludedLessonKinds: hiddenLessonKinds,
    rows,
    userId: session.user.id,
  });

  const items = candidates
    .map((candidate) => toContinueLearningItem({ candidate }))
    .filter((item): item is ContinueLearningItem => item !== null)
    .slice(0, MAX_CONTINUE_LEARNING_ITEMS);

  return { candidateCourseIds: rows.map((row) => row.courseId), items, userId: session.user.id };
}

/**
 * Converts every evaluated candidate into the curriculum tags that can make a
 * filtered or visible continuation card change after generation.
 */
function getCandidateCourseCacheTags(candidateCourseIds: string[]) {
  return candidateCourseIds.flatMap((courseId) => [
    getCourseCacheTag(courseId),
    getCourseCurriculumCacheTag(courseId),
  ]);
}

/**
 * Lists the authenticated learner's current continuation cards without
 * accepting an acting user id. The complete business query is private-cached
 * so sibling components and runtime prefetches share the same result.
 */
export function listCurrentUserContinueLearningItems(): Promise<ContinueLearningItem[]>;
export function listCurrentUserContinueLearningItems(
  options: ContinueLearningListOptions,
): Promise<ContinueLearningItem[] | null>;

export async function listCurrentUserContinueLearningItems(options?: ContinueLearningListOptions) {
  "use cache: private";

  const result = await loadContinueLearning();

  cacheTag(COURSE_LIST_CACHE_TAG, ...getCandidateCourseCacheTags(result.candidateCourseIds));

  if (result.userId) {
    cacheTag(getLessonVisibilityCacheTag(result.userId), getUserProgressCacheTag(result.userId));
  }

  if (!result.userId && options?.requireAuthentication) {
    return null;
  }

  return result.items;
}
