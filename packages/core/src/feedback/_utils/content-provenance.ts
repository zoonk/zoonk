import { type FeedbackContentKind, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";

type ContentProvenance = {
  model: string | null;
  promptVersion: string | null;
  runId: string | null;
};

/** `userId` is null for a visitor, who can only see public content. */
type LookupParams = { contentId: string; userId: string | null };

type ProvenanceLookup = (params: LookupParams) => Promise<ContentProvenance | null>;

const NO_PROVENANCE: ContentProvenance = { model: null, promptVersion: null, runId: null };

const provenanceSelect = { model: true, promptVersion: true, runId: true } as const;

/**
 * A private course belongs to the learner in its `userId` column. Courses record only the run that
 * wrote their outline.
 */
async function findCourseProvenance({ contentId, userId }: LookupParams) {
  const visibleCourse = userId
    ? { OR: [{ visibility: "public" as const }, { userId }] }
    : { visibility: "public" as const };

  const course = await prisma.course.findFirst({ where: { ...visibleCourse, id: contentId } });

  return course ? { ...NO_PROVENANCE, runId: course.outlineRunId } : null;
}

/** Tutor answers are private to the learner who asked; shared ones carry the run that wrote them. */
async function findLessonQuestionProvenance({ contentId, userId }: LookupParams) {
  if (!userId) {
    return null;
  }

  return prisma.lessonQuestion.findFirst({
    select: provenanceSelect,
    where: { id: contentId, thread: { userId } },
  });
}

/** Plans and their changes are private to the learner whose goal they serve. */
async function findPlanProvenance({ contentId, userId }: LookupParams) {
  if (!userId) {
    return null;
  }

  return prisma.plan.findFirst({
    select: provenanceSelect,
    where: { goal: { userId }, id: contentId },
  });
}

async function findPlanChangeProvenance({ contentId, userId }: LookupParams) {
  if (!userId) {
    return null;
  }

  return prisma.planChange.findFirst({
    select: provenanceSelect,
    where: { id: contentId, plan: { goal: { userId } } },
  });
}

/**
 * Each kind of AI content resolves to the model, prompt version and run that wrote it, or null when
 * it doesn't exist or isn't the reader's to see. Plans and tutor answers are private to their
 * learner; Library content is public unless another learner owns it.
 */
const provenanceLookups: Record<FeedbackContentKind, ProvenanceLookup> = {
  answerExplanation: ({ contentId }) =>
    prisma.answerExplanation.findUnique({ select: provenanceSelect, where: { id: contentId } }),
  chapter: ({ contentId, userId }) =>
    prisma.chapter.findFirst({
      select: provenanceSelect,
      where: { id: contentId, ...libraryRowsVisibleTo(userId) },
    }),
  course: findCourseProvenance,
  item: ({ contentId }) =>
    prisma.item.findUnique({ select: provenanceSelect, where: { id: contentId } }),
  lesson: ({ contentId, userId }) =>
    prisma.lesson.findFirst({
      select: provenanceSelect,
      where: { id: contentId, ...libraryRowsVisibleTo(userId) },
    }),
  lessonQuestion: findLessonQuestionProvenance,
  mediaAsset: ({ contentId }) =>
    prisma.mediaAsset.findUnique({ select: provenanceSelect, where: { id: contentId } }),
  plan: findPlanProvenance,
  planChange: findPlanChangeProvenance,
  step: ({ contentId, userId }) =>
    prisma.step.findFirst({
      select: provenanceSelect,
      where: { id: contentId, lesson: libraryRowsVisibleTo(userId) },
    }),
  stepVariant: ({ contentId, userId }) =>
    prisma.stepVariant.findFirst({
      select: provenanceSelect,
      where: { id: contentId, step: { lesson: libraryRowsVisibleTo(userId) } },
    }),
};

/**
 * Snapshots the provenance of the content a vote or a feedback message is about, so feedback can be
 * read per model and prompt version even after the content is regenerated. Null means the content
 * doesn't exist or the reader can't see it.
 */
export function findContentProvenance({
  contentId,
  contentKind,
  userId,
}: LookupParams & { contentKind: FeedbackContentKind }): Promise<ContentProvenance | null> {
  return provenanceLookups[contentKind]({ contentId, userId });
}
