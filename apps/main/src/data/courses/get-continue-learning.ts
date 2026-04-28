import "server-only";
import { type NextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { getSession } from "@zoonk/core/users/session/get";
import { type Chapter, type Course, type LessonKind, type Organization } from "@zoonk/db";
import { cache } from "react";
import {
  type ContinueLearningCandidate,
  listContinueLearningCandidates,
} from "./_utils/continue-learning-candidates";
import { type ContinueLearningState } from "./_utils/continue-learning-next-state";
import {
  type ContinueLearningRow,
  listRecentContinueLearningRows,
} from "./_utils/continue-learning-queries";

export const MAX_CONTINUE_LEARNING_ITEMS = 4;

type ContinueLearningResolvedState = NonNullable<ContinueLearningState>;

type PrefetchableContinueLearningState = ContinueLearningResolvedState & {
  lessonId: string;
  lessonKind: NonNullable<ContinueLearningResolvedState["lessonKind"]>;
};

type ContinueLearningLesson = {
  description: string;
  id: string;
  kind: LessonKind;
  position: number;
  slug: string;
  title: string | null;
};

type ContinueLearningPendingLesson = Pick<
  ContinueLearningLesson,
  "description" | "id" | "slug" | "title"
>;

type ContinueLearningChapter = Pick<Chapter, "id" | "slug">;

type ContinueLearningCourse = Pick<Course, "id" | "slug" | "title" | "imageUrl"> & {
  organization: Pick<Organization, "slug"> | null;
};

export type ContinueLearningCompletedItem = {
  status: "completed";
  lesson: ContinueLearningLesson;
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
};

export type ContinueLearningPendingItem = {
  status: "pending";
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
  lesson: ContinueLearningPendingLesson | null;
};

export type ContinueLearningItem = ContinueLearningCompletedItem | ContinueLearningPendingItem;

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
function toCompletedItemFromState({
  row,
  state,
}: {
  row: ContinueLearningRow;
  state: PrefetchableContinueLearningState;
}): ContinueLearningCompletedItem {
  return {
    chapter: {
      id: state.chapterId,
      slug: state.chapterSlug,
    },
    course: toCourse(row),
    lesson: {
      description: state.lessonDescription,
      id: state.lessonId,
      kind: state.lessonKind,
      position: state.lessonPosition,
      slug: state.lessonSlug,
      title: state.lessonTitle,
    },
    status: "completed",
  };
}

/**
 * The feed prefers the natural sequential next lesson whenever that target
 * still belongs to an open chapter in the current course tree.
 */
function toCompletedItemFromNext({
  next,
  row,
}: {
  next: NextLessonInCourse;
  row: ContinueLearningRow;
}): ContinueLearningCompletedItem {
  return {
    chapter: {
      id: next.chapterId,
      slug: next.chapterSlug,
    },
    course: toCourse(row),
    lesson: {
      description: next.lessonDescription,
      id: next.lessonId,
      kind: next.lessonKind,
      position: next.lessonPosition,
      slug: next.lessonSlug,
      title: next.lessonTitle,
    },
    status: "completed",
  };
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
 * completed-player links. Keeping that card shape in one helper avoids rebuilding
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
  return {
    chapter,
    course,
    lesson,
    status: "pending",
  };
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
    chapter: { id: state.chapterId, slug: state.chapterSlug },
    course: toCourse(row),
    lesson: {
      description: state.lessonDescription,
      id: state.lessonId,
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
  return toPendingItem({
    chapter: pendingTarget.chapter,
    course,
    lesson: pendingTarget.lesson,
  });
}

/**
 * The shared next-state only produces a completed lesson card when it can
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
    return toCompletedItemFromNext({
      next: candidate.sequentialNext,
      row: candidate.row,
    });
  }

  if (state.completed) {
    return candidate.pendingTarget
      ? toPendingItemFromTarget({
          course,
          pendingTarget: candidate.pendingTarget,
        })
      : null;
  }

  if (hasPrefetchableLesson(state)) {
    return toCompletedItemFromState({
      row: candidate.row,
      state,
    });
  }

  return toPendingItemFromState({
    row: candidate.row,
    state,
  });
}

/**
 * The cacheable continue-learning loader now reads like a pipeline: fetch
 * recent course anchors, enrich them with current navigation state, and then
 * convert those candidates into the final cards shown on the home feed.
 */
export const getContinueLearning = cache(
  async (headers?: Headers): Promise<ContinueLearningItem[]> => {
    const session = await getSession(headers);

    if (!session) {
      return [];
    }

    const userId = session.user.id;
    const rows = await listRecentContinueLearningRows({ userId });

    if (rows.length === 0) {
      return [];
    }

    const candidates = await listContinueLearningCandidates({
      rows,
      userId,
    });

    return candidates
      .map((candidate) => toContinueLearningItem({ candidate }))
      .filter((item): item is ContinueLearningItem => item !== null)
      .slice(0, MAX_CONTINUE_LEARNING_ITEMS);
  },
);
