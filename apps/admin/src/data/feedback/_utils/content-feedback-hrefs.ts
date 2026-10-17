import "server-only";
import { type FeedbackContentKind, prisma } from "@zoonk/db";

type ContentRef = { contentId: string; contentKind: FeedbackContentKind };

type ContentParents = {
  answerExplanationHrefs: Map<string, string>;
  libraryLessonIds: Set<string>;
  stepLessonIds: Map<string, string>;
  stepVariantLessonIds: Map<string, string>;
};

type HrefBuilder = (contentId: string, parents: ContentParents) => string | null;

function readIds(refs: ContentRef[], kind: FeedbackContentKind): string[] {
  return refs.filter((ref) => ref.contentKind === kind).map((ref) => ref.contentId);
}

/** Skips the query when no row of that kind is on the page. */
async function findWhenAny<Row>(ids: string[], find: (ids: string[]) => Promise<Row[]>) {
  return ids.length > 0 ? find(ids) : [];
}

function toAnswerExplanationHref(explanation: {
  itemId: string | null;
  step: { lessonId: string } | null;
}): string | null {
  if (explanation.itemId) {
    return `/items/${explanation.itemId}`;
  }

  return explanation.step ? `/lessons/${explanation.step.lessonId}` : null;
}

/**
 * Steps, step variants and answer explanations have no page of their own, so they link to the
 * lesson or item that shows them.
 */
async function findContentParents(refs: ContentRef[]): Promise<ContentParents> {
  const [libraryLessons, steps, stepVariants, explanations] = await Promise.all([
    findWhenAny(readIds(refs, "lesson"), (ids) =>
      prisma.lesson.findMany({ select: { id: true }, where: { id: { in: ids } } }),
    ),
    findWhenAny(readIds(refs, "step"), (ids) =>
      prisma.step.findMany({ select: { id: true, lessonId: true }, where: { id: { in: ids } } }),
    ),
    findWhenAny(readIds(refs, "stepVariant"), (ids) =>
      prisma.stepVariant.findMany({
        select: { id: true, step: { select: { lessonId: true } } },
        where: { id: { in: ids } },
      }),
    ),
    findWhenAny(readIds(refs, "answerExplanation"), (ids) =>
      prisma.answerExplanation.findMany({
        select: { id: true, itemId: true, step: { select: { lessonId: true } } },
        where: { id: { in: ids } },
      }),
    ),
  ]);

  return {
    answerExplanationHrefs: new Map(
      explanations.flatMap((explanation) => {
        const href = toAnswerExplanationHref(explanation);
        return href ? [[explanation.id, href] as const] : [];
      }),
    ),
    libraryLessonIds: new Set(libraryLessons.map((lesson) => lesson.id)),
    stepLessonIds: new Map(steps.map((step) => [step.id, step.lessonId])),
    stepVariantLessonIds: new Map(
      stepVariants.map((variant) => [variant.id, variant.step.lessonId]),
    ),
  };
}

function toLessonHref(contentId: string, parents: ContentParents): string | null {
  return parents.libraryLessonIds.has(contentId) ? `/lessons/${contentId}` : null;
}

function toParentLessonHref(lessonId: string | undefined): string | null {
  return lessonId ? `/lessons/${lessonId}` : null;
}

/** Chapters, plans and plan changes have no admin page, so their votes don't link anywhere. */
const hrefBuilders: Record<FeedbackContentKind, HrefBuilder> = {
  answerExplanation: (contentId, parents) => parents.answerExplanationHrefs.get(contentId) ?? null,
  chapter: () => null,
  course: (contentId) => `/courses/${contentId}`,
  item: (contentId) => `/items/${contentId}`,
  lesson: toLessonHref,
  lessonQuestion: (contentId) => `/questions/${contentId}`,
  mediaAsset: (contentId) => `/media/${contentId}`,
  plan: () => null,
  planChange: () => null,
  step: (contentId, parents) => toParentLessonHref(parents.stepLessonIds.get(contentId)),
  stepVariant: (contentId, parents) =>
    toParentLessonHref(parents.stepVariantLessonIds.get(contentId)),
};

/**
 * The admin page for each voted piece of content, keyed by `contentKind:contentId`. Content that was
 * regenerated or deleted since the vote has no entry.
 */
export async function findContentFeedbackHrefs(refs: ContentRef[]): Promise<Map<string, string>> {
  const parents = await findContentParents(refs);

  return new Map(
    refs.flatMap((ref) => {
      const href = hrefBuilders[ref.contentKind](ref.contentId, parents);
      return href ? [[toContentKey(ref), href] as const] : [];
    }),
  );
}

export function toContentKey(ref: ContentRef): string {
  return `${ref.contentKind}:${ref.contentId}`;
}
