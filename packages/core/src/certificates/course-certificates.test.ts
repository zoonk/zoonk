import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { testOutKnownPlanItems } from "../learner/_utils/known-skills";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { celebrateProgress } from "../milestones/celebrate-progress";
import { completePlanItem } from "../sessions/_utils/plan-items";
import { settleFinishedLesson } from "../sessions/settle-finished-lesson";
import { getFieldMapView } from "../view-models/map/get-field-map-view";
import { claimCourseCertificate } from "./claim-course-certificate";
import { getPublicCertificate } from "./get-public-certificate";
import { listCurrentUserCertificates } from "./list-certificates";
import { markCertificateShown } from "./mark-certificate-shown";

const TIME_ZONE = "America/Sao_Paulo";

const WON_CHALLENGE = { kind: "boss", status: "done" } as const;

type ItemSpec = { kind?: PlanItem["kind"]; minutes?: number | null; status?: PlanItem["status"] };

/**
 * A public course's plan: its lessons alternate between a beginner and an intermediate chapter.
 * Without a challenge of its own, the plan fixture adds one to do.
 */
async function courseGoal({
  items = [{ status: "done" }, { status: "todo" }, WON_CHALLENGE],
  kind = "learn",
}: { items?: ItemSpec[]; kind?: Goal["kind"] } = {}) {
  const [user, course, beginner, intermediate] = await Promise.all([
    userFixture({ name: "  Ana Souza  " }),
    courseFixture({ isPublished: true, title: "Quantum physics", visibility: "public" }),
    libraryChapterFixture({ title: "Light and matter" }),
    libraryChapterFixture({ level: "intermediate", title: "Waves" }),
  ]);

  const chapters = [beginner, intermediate];
  const lessons = await Promise.all(items.map(() => libraryLessonFixture()));

  await Promise.all([
    courseCategoryFixture({ category: "science", courseId: course.id }),
    courseChapterFixture({ chapterId: beginner.id, courseId: course.id, level: "beginner" }),
    courseChapterFixture({
      chapterId: intermediate.id,
      courseId: course.id,
      level: "intermediate",
    }),
  ]);

  const goal = await goalFixture({
    kind,
    primaryCourseId: course.id,
    timezone: TIME_ZONE,
    title: "My own words for it",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    items: items.map((item, index) => ({
      chapterId: item.kind === "boss" ? null : (chapters[index % 2]?.id ?? null),
      completedAt: item.status === "todo" ? null : new Date("2026-11-02T15:00:00Z"),
      kind: item.kind ?? "lesson",
      lessonId: item.kind === "boss" ? null : (lessons[index]?.id ?? null),
      minutes: item.minutes === undefined ? 30 : item.minutes,
      status: item.status ?? "todo",
    })),
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  return { course, goal, plan, user };
}

type CourseGoal = Awaited<ReturnType<typeof courseGoal>>;

function lastTodo({ plan }: CourseGoal) {
  const item = plan.items.findLast((entry) => entry.status === "todo");

  if (!item) {
    throw new Error("The plan has nothing left to do");
  }

  return item;
}

function finishLesson(fixture: CourseGoal, item = lastTodo(fixture)) {
  if (!item.lessonId) {
    throw new Error("Expected a lesson item");
  }

  return settleFinishedLesson({
    lessonId: item.lessonId,
    timeZone: TIME_ZONE,
    userId: fixture.user.id,
  });
}

function listCertificates(userId: string) {
  return prisma.certificate.findMany({ orderBy: { createdAt: "asc" }, where: { userId } });
}

async function readMapCertificate() {
  const result = await getFieldMapView();
  return result.status === "ready" ? result.map.certificate : "not ready";
}

describe("course certificates", () => {
  it("awards the course when its last lesson is finished, with what the course was", async () => {
    const fixture = await courseGoal();

    await finishLesson(fixture);

    const [certificate] = await listCertificates(fixture.user.id);

    expect(certificate).toMatchObject({
      courseId: fixture.course.id,
      goalId: fixture.goal.id,
      key: fixture.goal.id,
      kind: "course",
      language: "en",
      shownAt: null,
      title: "Quantum physics",
    });

    const facts = await getPublicCertificate(certificate?.code ?? "");

    expect(facts).toMatchObject({
      category: "science",
      courseLevels: [
        { chapters: 1, level: "beginner" },
        { chapters: 1, level: "intermediate" },
      ],
      kind: "course",
      lessonsStudied: 2,
      lessonsTestedOut: 0,
      minutes: 60,
      recipientName: "Ana Souza",
      topics: ["Light and matter", "Waves"],
    });
  });

  it("dates it on the learner's day, not the server's", async () => {
    const fixture = await courseGoal();

    await prisma.planItem.updateMany({
      data: { completedAt: new Date("2026-11-03T01:30:00Z"), status: "done" },
      where: { planId: fixture.plan.id },
    });

    const result = await claimCourseCertificate(fixture.goal.id);

    expect(result).toMatchObject({ certificate: { completedOn: "2026-11-02" }, status: "ready" });
  });

  it("keeps study time unknown when a studied lesson has no estimate", async () => {
    const fixture = await courseGoal({
      items: [{ minutes: null, status: "done" }, {}, WON_CHALLENGE],
    });

    await finishLesson(fixture);
    const [certificate] = await listCertificates(fixture.user.id);

    await expect(getPublicCertificate(certificate?.code ?? "")).resolves.toMatchObject({
      minutes: null,
    });
  });

  it("awards nothing while a lesson or the challenge is left, then once for the last", async () => {
    const fixture = await courseGoal({
      items: [{ status: "todo" }, { status: "todo" }, { kind: "boss", status: "todo" }],
    });

    await finishLesson(fixture, fixture.plan.items[0]);
    await finishLesson(fixture, fixture.plan.items[1]);
    await expect(listCertificates(fixture.user.id)).resolves.toHaveLength(0);

    const boss = fixture.plan.items[2]!;

    await writeLearnerChange({ userId: fixture.user.id }, (tx) =>
      completePlanItem(tx, { now: new Date(), planItemId: boss.id, userId: fixture.user.id }),
    );

    await expect(listCertificates(fixture.user.id)).resolves.toHaveLength(1);
  });

  it("awards an exam's course before its mocks, which rehearse the exam", async () => {
    const fixture = await courseGoal({
      items: [
        { status: "done" },
        { status: "todo" },
        { kind: "mock", status: "todo" },
        WON_CHALLENGE,
      ],
      kind: "exam",
    });

    await finishLesson(fixture, fixture.plan.items[1]);

    await expect(listCertificates(fixture.user.id)).resolves.toMatchObject([{ kind: "course" }]);
  });

  it("awards once when the last two lessons land at the same time", async () => {
    const fixture = await courseGoal({
      items: [{ status: "todo" }, { status: "todo" }, WON_CHALLENGE],
    });

    const lessons = fixture.plan.items.filter((item) => item.kind === "lesson");
    await Promise.all(lessons.map((item) => finishLesson(fixture, item)));

    await expect(listCertificates(fixture.user.id)).resolves.toHaveLength(1);
  });

  it("awards every plan a shared lesson finishes", async () => {
    const fixture = await courseGoal();
    const shared = lastTodo(fixture);
    const studied = await libraryLessonFixture();
    const other = await goalFixture({ userId: fixture.user.id });

    await planFixture({
      goalId: other.id,
      items: [
        { completedAt: new Date(), lessonId: studied.id, status: "done" },
        { lessonId: shared.lessonId, status: "todo" },
        WON_CHALLENGE,
      ],
    });

    await finishLesson(fixture, shared);

    const certificates = await listCertificates(fixture.user.id);
    const goalIds = new Set(certificates.map((row) => row.goalId));

    expect(goalIds).toStrictEqual(new Set([fixture.goal.id, other.id]));
  });

  it("awards when a test-out finishes the plan, but not for a plan nothing was studied in", async () => {
    const studied = await courseGoal();

    const untouched = await courseGoal({
      items: [{ status: "todo" }, { status: "todo" }, WON_CHALLENGE],
    });

    await Promise.all(
      [studied, untouched].map(async ({ goal, plan, user }) => {
        const todo = plan.items.filter((item) => item.kind === "lesson" && item.status === "todo");

        await writeLearnerChange({ userId: user.id }, (tx) =>
          testOutKnownPlanItems(tx, {
            goalId: goal.id,
            items: todo.map((item) => ({ ...item, skillIds: [item.skillId ?? ""] })),
            knownSkillIds: new Set(todo.map((item) => item.skillId ?? "")),
            testedOutAt: new Date(),
            timeZone: TIME_ZONE,
          }),
        );
      }),
    );

    await expect(listCertificates(studied.user.id)).resolves.toHaveLength(1);
    await expect(listCertificates(untouched.user.id)).resolves.toHaveLength(0);
  });

  it("counts the stand-ins a finishing test-out adds as passed by test", async () => {
    const [fixture, placed] = await Promise.all([courseGoal(), skillFixture()]);
    const todo = lastTodo(fixture);

    await writeLearnerChange({ userId: fixture.user.id }, (tx) =>
      testOutKnownPlanItems(tx, {
        goalId: fixture.goal.id,
        items: [{ ...todo, skillIds: [todo.skillId ?? ""] }],
        knownSkillIds: new Set([todo.skillId ?? "", placed.id]),
        placedSkills: [{ id: placed.id, phase: 0 }],
        testedOutAt: new Date(),
        timeZone: TIME_ZONE,
      }),
    );

    const [certificate] = await listCertificates(fixture.user.id);

    expect(certificate?.details).toMatchObject({ lessonsStudied: 1, lessonsTestedOut: 2 });
  });

  it("never awards a language goal's plan a course certificate", async () => {
    const fixture = await courseGoal({ kind: "language" });

    await finishLesson(fixture);

    await expect(listCertificates(fixture.user.id)).resolves.toHaveLength(0);
  });

  it("shows the moment in every result until the learner closes it", async () => {
    const fixture = await courseGoal();

    await finishLesson(fixture);

    const first = await celebrateProgress({ progress: null, userId: fixture.user.id });
    const replay = await celebrateProgress({ progress: null, userId: fixture.user.id });

    expect(first.certificates).toHaveLength(1);
    expect(replay.certificates).toStrictEqual(first.certificates);

    const code = first.certificates[0]?.code ?? "";
    await expect(markCertificateShown(code)).resolves.toStrictEqual({ status: "ready" });

    const [shown] = await listCertificates(fixture.user.id);

    await expect(markCertificateShown(code.toLowerCase())).resolves.toStrictEqual({
      status: "ready",
    });

    const [again] = await listCertificates(fixture.user.id);
    const after = await celebrateProgress({ progress: null, userId: fixture.user.id });

    expect(after.certificates).toStrictEqual([]);
    expect(again?.shownAt).toStrictEqual(shown?.shownAt);
  });
});

describe(claimCourseCertificate, () => {
  it("awards a course finished outside the award points, dated with its last work", async () => {
    const fixture = await courseGoal();

    await prisma.planItem.updateMany({
      data: { completedAt: new Date("2026-10-20T12:00:00Z"), status: "done" },
      where: { planId: fixture.plan.id },
    });

    await expect(readMapCertificate()).resolves.toStrictEqual({ code: null });

    const claimed = await claimCourseCertificate(fixture.goal.id);
    const again = await claimCourseCertificate(fixture.goal.id);

    expect(claimed).toMatchObject({
      certificate: { completedOn: "2026-10-20", kind: "course", shownAt: null },
      status: "ready",
    });

    expect(again).toStrictEqual(claimed);
    await expect(listCertificates(fixture.user.id)).resolves.toHaveLength(1);

    const code = claimed.status === "ready" ? claimed.certificate.code : null;
    await expect(readMapCertificate()).resolves.toStrictEqual({ code });
  });

  it("dates an exam's course by its course work, not a mock done after it", async () => {
    const fixture = await courseGoal({
      items: [
        { status: "done" },
        { status: "done" },
        { kind: "mock", status: "done" },
        WON_CHALLENGE,
      ],
      kind: "exam",
    });

    await prisma.planItem.updateMany({
      data: { completedAt: new Date("2026-10-01T12:00:00Z") },
      where: { kind: { not: "mock" }, planId: fixture.plan.id },
    });

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toMatchObject({
      certificate: { completedOn: "2026-10-01" },
    });
  });

  it("refuses an unfinished course and another learner's goal", async () => {
    const [fixture, other] = await Promise.all([courseGoal(), userFixture()]);

    await expect(readMapCertificate()).resolves.toBeNull();

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toStrictEqual({
      status: "notFinished",
    });

    mockSession(other.id);

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});

describe("a certificate as anyone sees it", () => {
  it("shows the public facts only, follows a rename and never marks it shown", async () => {
    const fixture = await courseGoal();
    await finishLesson(fixture);
    const [row] = await listCertificates(fixture.user.id);
    const code = row?.code ?? "";

    mockSession(null);

    const facts = await getPublicCertificate(
      `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`,
    );

    expect(Object.keys(facts ?? {}).toSorted()).toStrictEqual([
      "canDo",
      "category",
      "code",
      "completedOn",
      "courseId",
      "courseLevels",
      "kind",
      "language",
      "lessonsStudied",
      "lessonsTestedOut",
      "level",
      "minutes",
      "recipientName",
      "skillLevels",
      "targetLanguage",
      "title",
      "topics",
    ]);

    await prisma.user.update({
      data: { name: "Ana Beatriz Souza" },
      where: { id: fixture.user.id },
    });

    await expect(getPublicCertificate(code)).resolves.toMatchObject({
      recipientName: "Ana Beatriz Souza",
    });

    mockSession(fixture.user.id);

    await expect(listCurrentUserCertificates()).resolves.toMatchObject({
      certificates: [{ code, shownAt: null }],
      status: "ready",
    });

    await expect(getPublicCertificate("0000-0000-0000")).resolves.toBeNull();
    await expect(getPublicCertificate("not a code")).resolves.toBeNull();

    await expect(prisma.certificate.findUnique({ where: { code } })).resolves.toMatchObject({
      shownAt: null,
    });
  });

  it("outlives its course: the title stays and the course link goes", async () => {
    const fixture = await courseGoal();
    await finishLesson(fixture);
    const [row] = await listCertificates(fixture.user.id);

    await prisma.course.delete({ where: { id: fixture.course.id } });

    await expect(getPublicCertificate(row?.code ?? "")).resolves.toMatchObject({
      courseId: null,
      title: "Quantum physics",
    });
  });
});
