import "server-only";
import { type CourseLevel, type TransactionClient, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type GoalSkillRef } from "../curriculum/curriculum-scope";
import { type OutlineKeys } from "../curriculum/save-outline-chapter";
import { readLessonMap } from "../lessons/lesson-map";
import { toNameKey } from "./product-keys";

/** Enough of a long changelog to hold one release's notes. */
const NOTES_WINDOW = 60_000;
/** Text before the release's name, where a changelog puts its date and heading. */
const NOTES_LEAD = 500;

/** Where `token` first stands alone: "Product 1" and "2" never match inside "Product 12". */
function findToken({ text, token }: { text: string; token: string | null }): number {
  if (!token) {
    return -1;
  }

  const escaped = token.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return text.search(new RegExp(`(?<![\\p{L}\\p{N}.])${escaped}(?![\\p{L}\\p{N}]|\\.\\p{N})`, "u"));
}

/**
 * A changelog lists every release, so a course catching up on an older one reads from where the
 * release's name first appears, or else its version, rather than from the newest release at the top.
 */
function toReleaseNotes({
  name,
  text,
  version,
}: {
  name: string;
  text: string;
  version: string | null;
}): string {
  const byName = findToken({ text, token: name });
  const found = byName === -1 ? findToken({ text, token: version }) : byName;
  const start = Math.max(0, found - NOTES_LEAD);

  return text.slice(start, start + NOTES_WINDOW);
}

async function loadReleaseNotes(releaseId: string) {
  const release = await prisma.productRelease.findUniqueOrThrow({
    select: {
      name: true,
      product: { select: { name: true, releasesSource: true } },
      source: true,
      version: true,
    },
    where: { id: releaseId },
  });

  const page = release.source ?? release.product.releasesSource;

  return {
    name: release.name,
    page: page?.extractedText
      ? {
          contentHash: page.contentHash,
          sourceId: page.id,
          text: toReleaseNotes({ ...release, text: page.extractedText }),
        }
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

/** A release's What's new is its own: one chapter, lessons and skills per release and language. */
export function toWhatsNewKeys(releaseId: string): OutlineKeys {
  const prefix = `whats-new:${releaseId}`;

  return { chapter: prefix, skill: (name) => `${prefix}:${toNameKey(name)}` };
}

function toSkillKeys({ releaseId, whatsNew }: { releaseId: string; whatsNew: WhatsNew }) {
  const keys = toWhatsNewKeys(releaseId);
  return whatsNew.skills.map((skill) => ({ ...skill, identityKey: keys.skill(skill.name) }));
}

async function findWhatsNewSkills({
  language,
  releaseId,
  whatsNew,
}: {
  language: string;
  releaseId: string;
  whatsNew: WhatsNew;
}): Promise<GoalSkillRef[]> {
  const keys = [...new Set(toSkillKeys({ releaseId, whatsNew }).map((skill) => skill.identityKey))];

  const skills = await prisma.skill.findMany({
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

/**
 * Internal workflow bridge. One skill per new capability, release and language, so a retried or
 * repeated update saves it once.
 */
export async function saveWhatsNewSkills({
  courseId,
  provenance,
  releaseId,
  whatsNew,
}: {
  courseId: string;
  provenance: LibraryProvenance;
  releaseId: string;
  whatsNew: WhatsNew;
}): Promise<GoalSkillRef[]> {
  const { language } = await prisma.course.findUniqueOrThrow({
    select: { language: true },
    where: { id: courseId },
  });

  await prisma.skill.createMany({
    data: toSkillKeys({ releaseId, whatsNew }).map((skill) => ({
      ...toProvenanceData(provenance),
      description: skill.description,
      identityKey: skill.identityKey,
      language,
      level: whatsNew.level,
      name: skill.name,
      normalizedName: normalizeString(skill.name),
    })),
    skipDuplicates: true,
  });

  return findWhatsNewSkills({ language, releaseId, whatsNew });
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

/**
 * A lesson not written yet plans again for the new release, and one being written loses its claim,
 * so it can't publish what it planned for the old one.
 */
async function dropUnwrittenPlans({ courseId, tx }: { courseId: string; tx: TransactionClient }) {
  const unwritten = {
    contentStatus: { not: "completed" as const },
    homeChapter: { homeCourseId: courseId },
  };

  await tx.lesson.updateMany({
    data: { contentStatus: "pending" },
    where: { ...unwritten, contentStatus: "running" },
  });

  await tx.lesson.updateMany({ data: { specStatus: "pending" }, where: unwritten });
}

async function replayAdvance(comparison: ReleaseComparisonResult): Promise<string[] | null> {
  const notice = await prisma.sourceChangeNotice.findFirst({
    include: { reviewFlags: { select: { id: true } } },
    where: { runId: comparison.provenance.runId, sourceId: comparison.page.sourceId },
  });

  return notice ? notice.reviewFlags.map((flag) => flag.id) : null;
}

/**
 * Internal workflow bridge, the update's last write. Moves a main course to `toReleaseId`, only if
 * it still teaches `fromReleaseId`, in the transaction that flags the lessons the comparison found
 * changed, so a rewrite reads the new release. The notice is the release's own, not
 * `createSourceChangeNotice`, which would flag every lesson citing the page, pinned courses'
 * included. Returns the flags; a retry after the commit finds them by the comparison's run. Null
 * when the course moved meanwhile.
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
}): Promise<string[] | null> {
  const { language } = await prisma.course.findUniqueOrThrow({
    select: { language: true },
    where: { id: courseId },
  });

  const replay = comparison ? await replayAdvance(comparison) : null;

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

    await dropUnwrittenPlans({ courseId, tx });

    if (!comparison) {
      return [];
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

    return flagChangedLessons({ comparison, courseId, noticeId: notice.id, tx });
  });
}
