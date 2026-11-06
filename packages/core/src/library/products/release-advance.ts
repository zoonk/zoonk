import "server-only";
import { type CourseLevel, type TransactionClient, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type GoalSkillRef } from "../curriculum/curriculum-scope";
import { readLessonMap } from "../lessons/lesson-map";
import { toNameKey } from "./product-keys";

async function loadReleaseNotes(releaseId: string) {
  const release = await prisma.productRelease.findUniqueOrThrow({
    select: { name: true, product: { select: { name: true, releasesSource: true } }, source: true },
    where: { id: releaseId },
  });

  const page = release.source ?? release.product.releasesSource;

  return {
    name: release.name,
    page: page?.extractedText
      ? { contentHash: page.contentHash, sourceId: page.id, text: page.extractedText }
      : null,
    product: release.product.name,
  };
}

/** Only lessons homed in the course: a general lesson it borrows is never rewritten for one product. */
function loadCourseLessons(courseId: string) {
  return prisma.lesson.findMany({
    orderBy: { id: "asc" },
    select: { canDo: true, description: true, id: true, summary: true, title: true },
    where: { contentStatus: "completed", homeChapter: { homeCourseId: courseId } },
  });
}

/** Internal workflow bridge: what the release comparison reads, or null when the release has no page. */
export async function loadReleaseComparison({
  courseId,
  fromReleaseId,
  toReleaseId,
}: {
  courseId: string;
  fromReleaseId: string | null;
  toReleaseId: string;
}) {
  const [course, to, from, lessons] = await Promise.all([
    prisma.course.findUniqueOrThrow({ select: { language: true }, where: { id: courseId } }),
    loadReleaseNotes(toReleaseId),
    fromReleaseId
      ? prisma.productRelease.findUnique({ select: { name: true }, where: { id: fromReleaseId } })
      : null,
    loadCourseLessons(courseId),
  ]);

  if (!to.page) {
    return null;
  }

  return {
    from: from?.name ?? null,
    language: course.language,
    lessons: lessons.map((lesson) => ({
      canDo: lesson.canDo,
      id: lesson.id,
      ideas: readLessonMap(lesson.summary)?.ideas.map((idea) => idea.text) ?? [lesson.description],
      title: lesson.title,
    })),
    page: to.page,
    product: to.product,
    to: to.name,
  };
}

export type WhatsNew = {
  level: Exclude<CourseLevel, "overview">;
  offer: string;
  skills: { description: string; name: string }[];
  title: string;
};

export type ReleaseComparisonResult = {
  changedLessonIds: string[];
  /** The page the release notes came from, as compared. */
  page: { contentHash: string; sourceId: string };
  provenance: LibraryProvenance;
  /** The release's name, for the notice's message when there's no offer. */
  release: string;
  whatsNew: WhatsNew | null;
};

export type CourseAdvance = {
  /** When the course moved: goals made later get the updated course instead of an offer. */
  advancedAt: Date;
  flagIds: string[];
  skills: GoalSkillRef[];
};

function toSkillKeys({ releaseId, whatsNew }: { releaseId: string; whatsNew: WhatsNew | null }) {
  return (whatsNew?.skills ?? []).map((skill) => ({
    ...skill,
    identityKey: `whats-new:${releaseId}:${toNameKey(skill.name)}`,
  }));
}

async function findWhatsNewSkills({
  db,
  language,
  releaseId,
  whatsNew,
}: {
  db: Pick<TransactionClient, "skill">;
  language: string;
  releaseId: string;
  whatsNew: WhatsNew | null;
}): Promise<GoalSkillRef[]> {
  const keys = [...new Set(toSkillKeys({ releaseId, whatsNew }).map((skill) => skill.identityKey))];

  const skills = await db.skill.findMany({
    select: { description: true, id: true, identityKey: true, name: true },
    where: { identityKey: { in: keys }, language },
  });

  return keys.flatMap((key) => {
    const skill = skills.find((row) => row.identityKey === key);

    return skill
      ? [{ description: skill.description, id: skill.id, key: skill.id, name: skill.name }]
      : [];
  });
}

/** One skill per new capability and language, so a retried or concurrent advance saves it once. */
async function saveWhatsNewSkills({
  comparison,
  language,
  releaseId,
  tx,
}: {
  comparison: ReleaseComparisonResult;
  language: string;
  releaseId: string;
  tx: TransactionClient;
}): Promise<GoalSkillRef[]> {
  const { whatsNew } = comparison;

  await tx.skill.createMany({
    data: toSkillKeys({ releaseId, whatsNew }).map((skill) => ({
      ...toProvenanceData(comparison.provenance),
      description: skill.description,
      identityKey: skill.identityKey,
      language,
      level: whatsNew?.level ?? null,
      name: skill.name,
      normalizedName: normalizeString(skill.name),
    })),
    skipDuplicates: true,
  });

  return findWhatsNewSkills({ db: tx, language, releaseId, whatsNew });
}

async function flagChangedLessons({
  comparison,
  courseId,
  noticeId,
  tx,
}: {
  comparison: ReleaseComparisonResult;
  courseId: string;
  noticeId: string;
  tx: TransactionClient;
}): Promise<string[]> {
  const lessons = {
    homeChapter: { homeCourseId: courseId },
    id: { in: comparison.changedLessonIds },
  };

  const changed = await tx.lesson.findMany({ select: { id: true }, where: lessons });

  await tx.contentReviewFlag.createMany({
    data: changed.map((lesson) => ({ lessonId: lesson.id, noticeId })),
    skipDuplicates: true,
  });

  // Each rewrite plans its lesson again, for the release the course teaches now.
  await tx.lesson.updateMany({ data: { specStatus: "pending" }, where: lessons });

  const flags = await tx.contentReviewFlag.findMany({ select: { id: true }, where: { noticeId } });
  return flags.map((flag) => flag.id);
}

async function replayAdvance({
  comparison,
  language,
  toReleaseId,
}: {
  comparison: ReleaseComparisonResult;
  language: string;
  toReleaseId: string;
}): Promise<CourseAdvance | null> {
  const notice = await prisma.sourceChangeNotice.findFirst({
    include: { reviewFlags: { select: { id: true } } },
    where: { runId: comparison.provenance.runId, sourceId: comparison.page.sourceId },
  });

  if (!notice) {
    return null;
  }

  return {
    advancedAt: notice.createdAt,
    flagIds: notice.reviewFlags.map((flag) => flag.id),
    skills: await findWhatsNewSkills({
      db: prisma,
      language,
      releaseId: toReleaseId,
      whatsNew: comparison.whatsNew,
    }),
  };
}

/**
 * Internal workflow bridge. Moves a main course to `toReleaseId`, only if it still teaches
 * `fromReleaseId`, in the transaction that flags the lessons the comparison found changed and saves
 * the release's new skills, so a rewrite reads the new release. The notice is the release's own,
 * not `createSourceChangeNotice`, which would flag every lesson citing the page, pinned courses'
 * included. A retry after the commit finds that notice by the comparison's run and returns the same
 * result. Null when the course moved meanwhile.
 */
export async function advanceCourseRelease({
  comparison,
  courseId,
  fromReleaseId,
  toReleaseId,
}: {
  comparison: ReleaseComparisonResult | null;
  courseId: string;
  fromReleaseId: string | null;
  toReleaseId: string;
}): Promise<CourseAdvance | null> {
  const { language } = await prisma.course.findUniqueOrThrow({
    select: { language: true },
    where: { id: courseId },
  });

  const replay = comparison ? await replayAdvance({ comparison, language, toReleaseId }) : null;

  if (replay) {
    return replay;
  }

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.course.updateMany({
      data: { productReleaseId: toReleaseId },
      where: { id: courseId, isPinned: false, productReleaseId: fromReleaseId },
    });

    if (count === 0) {
      return null;
    }

    if (!comparison) {
      return { advancedAt: new Date(), flagIds: [], skills: [] };
    }

    const notice = await tx.sourceChangeNotice.create({
      data: {
        ...toProvenanceData(comparison.provenance),
        contentHash: comparison.page.contentHash,
        fields: ["release"],
        language,
        message: comparison.whatsNew?.offer ?? comparison.release,
        previousHash: comparison.page.contentHash,
        sourceId: comparison.page.sourceId,
      },
    });

    return {
      advancedAt: notice.createdAt,
      flagIds: await flagChangedLessons({ comparison, courseId, noticeId: notice.id, tx }),
      skills: await saveWhatsNewSkills({ comparison, language, releaseId: toReleaseId, tx }),
    };
  });
}
