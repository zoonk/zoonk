import "server-only";
import { type Certificate, CourseLevel, type PlanItem, type TransactionClient } from "@zoonk/db";
import { isValidCategory } from "@zoonk/utils/categories";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { isCourseFinished } from "../../plans/_utils/plan-end";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "../../plans/_utils/work-progress";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type CourseCertificateDetails } from "../certificate-contract";
import { createCertificateCode } from "./certificate-code";

const LEVEL_ORDER = Object.values(CourseLevel);

const COURSE_WORK_KINDS: ReadonlySet<PlanItem["kind"]> = new Set(["lesson", "chapter", "boss"]);

type CourseItem = Pick<
  PlanItem,
  "chapterId" | "completedAt" | "kind" | "lessonId" | "lessons" | "minutes" | "skillId" | "status"
>;

async function loadCoursePlan(tx: TransactionClient, planId: string) {
  return tx.plan.findUnique({
    select: {
      goal: {
        select: {
          id: true,
          kind: true,
          language: true,
          primaryCourseId: true,
          targetDate: true,
          timezone: true,
          title: true,
          userId: true,
        },
      },
      items: {
        orderBy: { position: "asc" },
        select: {
          chapterId: true,
          completedAt: true,
          kind: true,
          lessonId: true,
          lessons: true,
          minutes: true,
          skillId: true,
          status: true,
        },
      },
      phases: true,
      settings: true,
    },
    where: { id: planId },
  });
}

type CoursePlan = NonNullable<Awaited<ReturnType<typeof loadCoursePlan>>>;

/** The plan's chapters in plan order; a lesson without its chapter on the item counts in its home chapter. */
async function listPlanChapterIds(
  tx: TransactionClient,
  items: readonly CourseItem[],
): Promise<string[]> {
  const learn = items.filter((item) => LEARN_KINDS.has(item.kind));

  const lessonIds = learn.flatMap((item) =>
    !item.chapterId && item.lessonId ? item.lessonId : [],
  );

  const lessons =
    lessonIds.length > 0
      ? await tx.lesson.findMany({
          select: { homeChapterId: true, id: true },
          where: { id: { in: lessonIds } },
        })
      : [];

  const homeChapters = new Map(lessons.map((lesson) => [lesson.id, lesson.homeChapterId]));

  const chapterIds = learn.flatMap(
    (item) => item.chapterId ?? (item.lessonId ? homeChapters.get(item.lessonId) : null) ?? [],
  );

  return [...new Set(chapterIds)];
}

async function loadCourse(tx: TransactionClient, courseId: string | null) {
  if (!courseId) {
    return null;
  }

  return tx.course.findUnique({
    select: {
      categories: { orderBy: { createdAt: "asc" }, select: { category: true }, take: 1 },
      courseChapters: { select: { chapterId: true, level: true } },
      title: true,
      visibility: true,
    },
    where: { id: courseId },
  });
}

type CertificateCourse = Awaited<ReturnType<typeof loadCourse>>;

function getCourseLevels({
  chapterIds,
  course,
}: {
  chapterIds: readonly string[];
  course: CertificateCourse;
}): CourseCertificateDetails["courseLevels"] {
  if (!course || course.visibility === "private") {
    return [];
  }

  const inPlan = new Set(chapterIds);

  return LEVEL_ORDER.flatMap((level) => {
    const chapters = course.courseChapters.filter(
      (placement) => placement.level === level && inPlan.has(placement.chapterId),
    ).length;

    return chapters > 0 ? [{ chapters, level }] : [];
  });
}

async function listTopics({
  chapterIds,
  phases,
  tx,
}: {
  chapterIds: readonly string[];
  phases: CoursePlan["phases"];
  tx: TransactionClient;
}): Promise<string[]> {
  if (chapterIds.length === 0) {
    return parsePlanPhases(phases).map((phase) => phase.name);
  }

  const chapters = await tx.chapter.findMany({
    select: { id: true, title: true },
    where: { id: { in: [...chapterIds] } },
  });

  const titles = new Map(chapters.map((chapter) => [chapter.id, chapter.title]));
  return chapterIds.flatMap((id) => titles.get(id) ?? []);
}

/** Unknown when any studied lesson has no estimate (legacy items), rather than undercounted. */
function sumStudiedMinutes(studied: readonly CourseItem[]): number | null {
  const minutes = studied.map((item) => item.minutes);

  if (minutes.includes(null)) {
    return null;
  }

  return Math.round(minutes.reduce((sum: number, value) => sum + (value ?? 0), 0));
}

/** The last course work the learner finished dates the certificate, so a later claim keeps that day. */
function getLastFinishedAt(items: readonly CourseItem[]): Date {
  const times = items
    .filter(
      (item) => COURSE_WORK_KINDS.has(item.kind) && isWorkFinished(item.status) && item.completedAt,
    )
    .map((item) => item.completedAt?.getTime() ?? 0);

  return times.length > 0 ? new Date(Math.max(...times)) : new Date();
}

async function buildCourseDetails({
  plan,
  tx,
}: {
  plan: CoursePlan;
  tx: TransactionClient;
}): Promise<{ details: CourseCertificateDetails; title: string }> {
  const [chapterIds, course] = await Promise.all([
    listPlanChapterIds(tx, plan.items),
    loadCourse(tx, plan.goal.primaryCourseId),
  ]);

  const topics = await listTopics({ chapterIds, phases: plan.phases, tx });
  const lessons = plan.items.filter((item) => item.kind === "lesson");
  const studied = lessons.filter((item) => getWorkProgress(item.status) === "studied");
  const category = course?.categories[0]?.category ?? null;

  return {
    details: {
      category: isValidCategory(category) ? category : null,
      courseLevels: getCourseLevels({ chapterIds, course }),
      lessonsStudied: countLessons(studied),
      lessonsTestedOut: countLessons(
        lessons.filter((item) => getWorkProgress(item.status) === "testedOut"),
      ),
      minutes: sumStudiedMinutes(studied),
      topics,
    },
    title: course?.title ?? plan.goal.title,
  };
}

/**
 * Finds the plan's course certificate, or writes it once its course is finished
 * (`isCourseFinished`). Callers hold the learner's lock, so two finishes of the
 * same plan write one; the unique key backs that up.
 */
export async function awardCourseCertificate(
  tx: TransactionClient,
  planId: string,
): Promise<{ certificate: Certificate; created: boolean } | null> {
  const plan = await loadCoursePlan(tx, planId);

  if (!plan) {
    return null;
  }

  const { goal } = plan;
  const key = { key: goal.id, kind: "course" as const, userId: goal.userId };
  const existing = await tx.certificate.findUnique({ where: { userCertificate: key } });

  if (existing) {
    return { certificate: existing, created: false };
  }

  const finished = isCourseFinished({
    goalKind: goal.kind,
    items: plan.items,
    phases: parsePlanPhases(plan.phases),
    studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan.settings).fullCourse,
    targetDate: goal.targetDate,
  });

  if (!finished) {
    return null;
  }

  const { details, title } = await buildCourseDetails({ plan, tx });

  const certificate = await tx.certificate.create({
    data: {
      ...key,
      code: createCertificateCode(),
      completedOn: getDateInTimeZone({
        date: getLastFinishedAt(plan.items),
        timeZone: getAnswerTimeZone({ goal }),
      }),
      courseId: goal.primaryCourseId,
      details,
      goalId: goal.id,
      language: goal.language,
      title,
    },
  });

  return { certificate, created: true };
}

/**
 * Only finished lessons, chapters and challenges can finish a course, and each plan's work left is
 * counted first, so other writes read nothing more.
 */
export async function awardCourseCertificates(
  tx: TransactionClient,
  { finished }: { finished: readonly Pick<PlanItem, "kind" | "planId">[] },
): Promise<void> {
  const ids = [
    ...new Set(
      finished.filter((item) => COURSE_WORK_KINDS.has(item.kind)).map((item) => item.planId),
    ),
  ];

  if (ids.length === 0) {
    return;
  }

  const open = await tx.planItem.groupBy({
    by: ["planId"],
    where: { kind: { in: [...COURSE_WORK_KINDS] }, planId: { in: ids }, status: "todo" },
  });

  const withWorkLeft = new Set(open.map((row) => row.planId));

  for (const planId of ids.filter((id) => !withWorkLeft.has(id))) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    await awardCourseCertificate(tx, planId);
  }
}
