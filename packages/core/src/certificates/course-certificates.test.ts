import { randomUUID } from "node:crypto";
import { type CourseLevel, type Goal, type PlanItem, prisma } from "@zoonk/db";
import { certificateFixture } from "@zoonk/testing/fixtures/certificates";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { testOutKnownPlanItems } from "../learner/_utils/known-skills";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { celebrateProgress } from "../milestones/celebrate-progress";
import { completePlanItem } from "../sessions/_utils/plan-items";
import { settleFinishedLesson } from "../sessions/settle-finished-lesson";
import { reconcileAppleSubscription } from "../subscriptions/reconcile-apple-subscription";
import { getFieldMapView } from "../view-models/map/get-field-map-view";
import { claimCourseCertificate } from "./claim-course-certificate";
import { getPublicCertificate } from "./get-public-certificate";
import { listCurrentUserCertificates } from "./list-certificates";
import { markCertificateShown } from "./mark-certificate-shown";

const TIME_ZONE = "America/Sao_Paulo";

const WON_CHALLENGE = { kind: "boss", status: "done" } as const;

type ChapterSpec = { level?: CourseLevel; title: string };

type ItemSpec = {
  chapter?: number;
  completedAt?: Date;
  kind?: PlanItem["kind"];
  minutes?: number | null;
  phase?: number;
  status?: PlanItem["status"];
};

const ONE_LEVEL: ChapterSpec[] = [{ title: "Light and matter" }, { title: "Waves" }];

const TWO_LEVELS: ChapterSpec[] = [
  { level: "beginner", title: "Light and matter" },
  { level: "intermediate", title: "Waves" },
];

/**
 * A public Library course's plan. Lessons alternate between its chapters unless an item names
 * one; without a challenge of its own, the plan fixture adds one to do.
 */
async function courseGoal({
  chapters: specs = ONE_LEVEL,
  course: courseAttrs = {},
  details,
  items = [{ status: "done" }, { status: "todo" }, WON_CHALLENGE],
  kind = "learn",
}: {
  chapters?: ChapterSpec[];
  course?: Parameters<typeof courseFixture>[0];
  details?: Parameters<typeof goalFixture>[0]["details"];
  items?: ItemSpec[];
  kind?: Goal["kind"];
} = {}) {
  const [user, course, chapters, lessons] = await Promise.all([
    userFixture({ name: "  Ana Souza  " }),
    courseFixture({
      isPublished: true,
      title: "Quantum physics",
      visibility: "public",
      ...courseAttrs,
    }),
    Promise.all(
      specs.map((spec) =>
        libraryChapterFixture({ level: spec.level ?? "beginner", title: spec.title }),
      ),
    ),
    Promise.all(items.map(() => libraryLessonFixture())),
  ]);

  await Promise.all([
    courseCategoryFixture({ category: "science", courseId: course.id }),
    ...chapters.map((chapter, position) =>
      courseChapterFixture({
        chapterId: chapter.id,
        courseId: course.id,
        level: specs[position]?.level ?? "beginner",
        position,
      }),
    ),
  ]);

  const goal = await goalFixture({
    details,
    kind,
    primaryCourseId: course.id,
    timezone: TIME_ZONE,
    title: "My own words for it",
    userId: user.id,
  });

  const phases = Math.max(1, ...items.map((item) => (item.phase ?? 0) + 1));

  const plan = await planFixture({
    goalId: goal.id,
    items: items.map((item, index) => {
      const isChallenge = item.kind === "boss";
      const chapter = chapters[item.chapter ?? index % chapters.length];

      return {
        chapterId: isChallenge ? null : (chapter?.id ?? null),
        completedAt:
          item.status === "todo" ? null : (item.completedAt ?? new Date("2026-11-02T15:00:00Z")),
        kind: item.kind ?? "lesson",
        lessonId: isChallenge ? null : (lessons[index]?.id ?? null),
        minutes: item.minutes === undefined ? 30 : item.minutes,
        phase: item.phase ?? 0,
        status: item.status ?? "todo",
      };
    }),
    phases: Array.from({ length: phases }, (_phase, index) => ({ name: `Phase ${index + 1}` })),
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  return { chapters, course, goal, plan, user };
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

async function readMapCertificates() {
  const result = await getFieldMapView();
  return result.status === "ready" ? result.map.certificates : "not ready";
}

describe("course certificates", () => {
  it("awards the level when its last lesson is finished, with what the level was", async () => {
    const fixture = await courseGoal();

    await finishLesson(fixture);

    const [certificate, ...more] = await listCertificates(fixture.user.id);

    expect(more).toStrictEqual([]);

    expect(certificate).toMatchObject({
      courseId: fixture.course.id,
      courseLevel: "beginner",
      goalId: fixture.goal.id,
      key: `${fixture.course.id}:beginner`,
      kind: "course",
      language: "en",
      shownAt: null,
      title: "Quantum physics",
    });

    const facts = await listCurrentUserCertificates();

    expect(facts).toMatchObject({
      certificates: [
        {
          category: "science",
          courseLevel: "beginner",
          kind: "course",
          lessonsStudied: 2,
          lessonsTestedOut: 0,
          minutes: 60,
          recipientName: "Ana Souza",
          topics: ["Light and matter", "Waves"],
        },
      ],
    });
  });

  it("dates it on the learner's day, not the server's", async () => {
    const fixture = await courseGoal();

    await prisma.planItem.updateMany({
      data: { completedAt: new Date("2026-11-03T01:30:00Z"), status: "done" },
      where: { planId: fixture.plan.id },
    });

    const result = await claimCourseCertificate(fixture.goal.id);

    expect(result).toMatchObject({
      certificates: [{ completedOn: "2026-11-02" }],
      status: "ready",
    });
  });

  it("keeps study time unknown when a studied lesson has no estimate", async () => {
    const fixture = await courseGoal({
      items: [{ minutes: null, status: "done" }, {}, WON_CHALLENGE],
    });

    await finishLesson(fixture);

    await expect(listCurrentUserCertificates()).resolves.toMatchObject({
      certificates: [{ minutes: null }],
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

    const other = await goalFixture({
      primaryCourseId: fixture.course.id,
      userId: fixture.user.id,
    });

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
    const [fixture, placed] = await Promise.all([
      courseGoal(),
      skillFixture({ level: "beginner" }),
    ]);

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

describe("level and plan certificates", () => {
  it("awards each level as its phase finishes, and no plan certificate the levels cover", async () => {
    const fixture = await courseGoal({
      chapters: TWO_LEVELS,
      items: [
        { chapter: 0 },
        { kind: "boss" },
        { chapter: 1, phase: 1 },
        { kind: "boss", phase: 1 },
      ],
    });

    const [beginner, firstChallenge, intermediate, lastChallenge] = fixture.plan.items;

    const complete = (planItemId: string) =>
      writeLearnerChange({ userId: fixture.user.id }, (tx) =>
        completePlanItem(tx, { now: new Date(), planItemId, userId: fixture.user.id }),
      );

    await finishLesson(fixture, beginner);
    await expect(listCertificates(fixture.user.id)).resolves.toStrictEqual([]);

    await complete(firstChallenge?.id ?? "");

    await expect(listCertificates(fixture.user.id)).resolves.toMatchObject([
      { courseLevel: "beginner", details: { topics: ["Light and matter"] } },
    ]);

    await finishLesson(fixture, intermediate);
    await complete(lastChallenge?.id ?? "");

    await expect(listCertificates(fixture.user.id)).resolves.toMatchObject([
      { courseLevel: "beginner" },
      { courseLevel: "intermediate", details: { topics: ["Waves"] } },
    ]);
  });

  it("certifies a level once per learner, dated where they first finished it", async () => {
    const first = await courseGoal({
      items: [
        { completedAt: new Date("2026-10-01T15:00:00Z"), status: "done" },
        { completedAt: new Date("2026-10-01T15:00:00Z"), status: "done" },
        { ...WON_CHALLENGE, completedAt: new Date("2026-10-01T15:00:00Z") },
      ],
    });

    const again = await goalFixture({
      primaryCourseId: first.course.id,
      timezone: TIME_ZONE,
      userId: first.user.id,
    });

    await planFixture({
      goalId: again.id,
      items: [
        ...first.chapters.map((chapter) => ({
          chapterId: chapter.id,
          completedAt: new Date("2026-10-20T15:00:00Z"),
          status: "done" as const,
        })),
        { ...WON_CHALLENGE, completedAt: new Date() },
      ],
    });

    const claimed = await claimCourseCertificate(first.goal.id);
    const repeated = await claimCourseCertificate(again.id);

    expect(repeated).toStrictEqual(claimed);
    expect(claimed).toMatchObject({ certificates: [{ completedOn: "2026-10-01" }] });

    await expect(listCertificates(first.user.id)).resolves.toMatchObject([
      { goalId: first.goal.id },
    ]);
  });

  it("certifies a plan that skipped part of a level as the plan, whatever its details say", async () => {
    const fixture = await courseGoal({
      chapters: [...ONE_LEVEL, { title: "Optics" }],
      details: { courseStart: { chapterId: null } },
      items: [{ chapter: 1, status: "done" }, { chapter: 2, status: "done" }, WON_CHALLENGE],
    });

    const [skipped, skill] = await Promise.all([libraryLessonFixture(), skillFixture()]);

    // Skipping an area takes its lessons out of the plan but leaves its skills in the graph.
    await Promise.all([
      chapterLessonFixture({ chapterId: fixture.chapters[0]?.id ?? "", lessonId: skipped.id }),
      lessonSkillFixture({ lessonId: skipped.id, skillId: skill.id }),
      prisma.plan.update({
        data: { graph: { skills: plannedSkills([{ id: skill.id, name: skill.name }]) } },
        where: { id: fixture.plan.id },
      }),
    ]);

    await updateGoal({ goalId: fixture.goal.id, input: { details: {} } });

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toMatchObject({
      certificates: [
        {
          courseLevel: null,
          lessonsStudied: 2,
          title: "Quantum physics",
          topics: ["Waves", "Optics"],
        },
      ],
      status: "ready",
    });

    await expect(listCertificates(fixture.user.id)).resolves.toMatchObject([
      { courseLevel: null, key: fixture.goal.id },
    ]);
  });

  it.each([
    ["a private course", { visibility: "private" }],
    ["an exam's course", { format: "exam" }],
  ] as const)("certifies %s's plan whole", async (_label, course) => {
    const fixture = await courseGoal({ chapters: TWO_LEVELS, course });

    await finishLesson(fixture);

    await expect(listCertificates(fixture.user.id)).resolves.toMatchObject([
      { courseLevel: null, key: fixture.goal.id, title: "Quantum physics" },
    ]);
  });
});

const APPLE_PLUS = { billingInterval: "month", plan: "plus" } as const;

function applePlus(userId: string, { isActive = true }: { isActive?: boolean } = {}) {
  return reconcileAppleSubscription({
    product: APPLE_PLUS,
    referenceId: userId,
    verifiedSubscription: {
      accountToken: userId,
      environment: "sandbox",
      eventId: randomUUID(),
      eventSignedDate: new Date(),
      expirationDate: new Date("2099-01-01T00:00:00Z"),
      isActive,
      isAutoRenewEnabled: isActive,
      originalTransactionId: `plus-${userId}`,
      productId: "com.zoonk.plus.monthly",
      purchaseDate: new Date("2026-10-01T00:00:00Z"),
      revocationDate: isActive ? null : new Date(),
      transactionId: randomUUID(),
      transactionSignedDate: new Date(),
    },
  });
}

describe("certificates with and without Plus", () => {
  it("earns a free learner a locked certificate, which subscribing issues as it was", async () => {
    const fixture = await courseGoal();
    await finishLesson(fixture);
    const [earned] = await listCertificates(fixture.user.id);
    const code = earned?.code ?? "";

    expect(earned?.issuedAt).toBeNull();
    await expect(getPublicCertificate(code)).resolves.toBeNull();

    await expect(listCurrentUserCertificates()).resolves.toMatchObject({
      certificates: [{ code, locked: true }],
    });

    await expect(
      celebrateProgress({ progress: null, userId: fixture.user.id }),
    ).resolves.toMatchObject({ certificates: [{ code, locked: true }] });

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toMatchObject({
      certificates: [{ code, locked: true }],
    });

    await expect(markCertificateShown(code)).resolves.toStrictEqual({ status: "ready" });
    const [shown] = await listCertificates(fixture.user.id);

    await applePlus(fixture.user.id);
    const [issued] = await listCertificates(fixture.user.id);

    expect(issued).toStrictEqual({ ...shown, issuedAt: expect.any(Date) });
    await expect(getPublicCertificate(code)).resolves.toMatchObject({ code });

    await applePlus(fixture.user.id, { isActive: false });

    await expect(listCertificates(fixture.user.id)).resolves.toStrictEqual([issued]);
  });

  it("issues a Plus learner's certificate as it's earned", async () => {
    const fixture = await courseGoal();
    await applePlus(fixture.user.id);

    await finishLesson(fixture);

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toMatchObject({
      certificates: [{ locked: false }],
    });

    await expect(readMapCertificates()).resolves.toMatchObject({ earned: [{ locked: false }] });
  });
});

describe(claimCourseCertificate, () => {
  it("awards each level finished outside the award points, dated with its own last work", async () => {
    const fixture = await courseGoal({
      chapters: TWO_LEVELS,
      items: [
        { chapter: 0, completedAt: new Date("2026-10-20T12:00:00Z"), status: "done" },
        { completedAt: new Date("2026-10-20T12:00:00Z"), kind: "boss", status: "done" },
        { chapter: 1, completedAt: new Date("2026-10-25T12:00:00Z"), phase: 1, status: "done" },
        { completedAt: new Date("2026-10-25T12:00:00Z"), kind: "boss", phase: 1, status: "done" },
      ],
    });

    await expect(readMapCertificates()).resolves.toStrictEqual({
      earned: [],
      unclaimed: [{ courseLevel: "beginner" }, { courseLevel: "intermediate" }],
    });

    const claimed = await claimCourseCertificate(fixture.goal.id);
    const again = await claimCourseCertificate(fixture.goal.id);

    expect(claimed).toMatchObject({
      certificates: [
        {
          completedOn: "2026-10-20",
          courseLevel: "beginner",
          shownAt: null,
          topics: ["Light and matter"],
        },
        {
          completedOn: "2026-10-25",
          courseLevel: "intermediate",
          shownAt: null,
          topics: ["Waves"],
        },
      ],
      status: "ready",
    });

    expect(again).toStrictEqual(claimed);
    await expect(listCertificates(fixture.user.id)).resolves.toHaveLength(2);

    const codes = claimed.status === "ready" ? claimed.certificates.map((row) => row.code) : [];

    await expect(readMapCertificates()).resolves.toStrictEqual({
      earned: [
        { code: codes[0], courseLevel: "beginner", locked: true },
        { code: codes[1], courseLevel: "intermediate", locked: true },
      ],
      unclaimed: [],
    });
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
      certificates: [{ completedOn: "2026-10-01" }],
    });
  });

  it("offers a plan without a primary course only once a chapter's home course can name it", async () => {
    const fixture = await courseGoal({
      items: [{ status: "done" }, { status: "done" }, WON_CHALLENGE],
    });

    await prisma.goal.update({ data: { primaryCourseId: null }, where: { id: fixture.goal.id } });

    await expect(readMapCertificates()).resolves.toBeNull();

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toStrictEqual({
      status: "notFinished",
    });

    await prisma.chapter.update({
      data: { homeCourseId: fixture.course.id },
      where: { id: fixture.chapters[1]?.id },
    });

    await expect(readMapCertificates()).resolves.toStrictEqual({
      earned: [],
      unclaimed: [{ courseLevel: null }],
    });

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toMatchObject({
      certificates: [{ courseLevel: null, title: "Quantum physics" }],
      status: "ready",
    });
  });

  it("refuses an unfinished course and another learner's goal", async () => {
    const [fixture, other] = await Promise.all([courseGoal(), userFixture()]);

    await expect(readMapCertificates()).resolves.toBeNull();

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
    await applePlus(fixture.user.id);
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
      "courseLevel",
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

  it("lists the learner's certificates by the day each was finished, newest first", async () => {
    const user = await userFixture();

    const finishedLater = await certificateFixture({
      completedOn: new Date("2026-10-25T00:00:00Z"),
      userId: user.id,
    });

    const claimedLater = await certificateFixture({
      completedOn: new Date("2026-10-20T00:00:00Z"),
      userId: user.id,
    });

    mockSession(user.id);

    await expect(listCurrentUserCertificates()).resolves.toMatchObject({
      certificates: [{ code: finishedLater.code }, { code: claimedLater.code }],
    });
  });

  it("outlives its course: the title stays and the course link goes", async () => {
    const fixture = await courseGoal();
    await applePlus(fixture.user.id);
    await finishLesson(fixture);
    const [row] = await listCertificates(fixture.user.id);

    await prisma.course.delete({ where: { id: fixture.course.id } });

    await expect(getPublicCertificate(row?.code ?? "")).resolves.toMatchObject({
      courseId: null,
      title: "Quantum physics",
    });
  });
});
