import {
  type CourseLevel,
  type Goal,
  type LibraryVisibility,
  type PlanItem,
  type User,
  prisma,
} from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
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
import { CEFR_LEVELS, type CefrLevel } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { mergeSkills } from "../_test-utils/merge-skills";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { finishLanguageLevelTest } from "../language/level-test/finish-language-level-test";
import { type LevelTestBank } from "../language/level-test/level-test-contract";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { testOutKnownPlanItems } from "../learner/_utils/test-out-known-plan-items";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { bringBackMissedLessons } from "../plans/bring-back-missed-lessons";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { type PlanGraphSkill, parsePlanGraph } from "../plans/planner/plan-state";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { completeLessonPlanItems } from "../sessions/_utils/plan-items";
import { claimCourseCertificate } from "./claim-course-certificate";

const TIME_ZONE = "America/Sao_Paulo";
const EARLIER = new Date("2026-10-20T15:00:00Z");

const BANDS: Record<CefrLevel, CourseLevel> = {
  A1: "beginner",
  A2: "beginner",
  B1: "intermediate",
  B2: "intermediate",
  C1: "advanced",
  C2: "advanced",
};

/** `standIn` makes a stand-in of that many lessons; any other item is a written lesson of its unit. */
type ItemSpec = {
  completedAt?: Date;
  skill: number;
  standIn?: number;
  status?: PlanItem["status"];
  unit?: number;
};

/** An Italian plan for a Portuguese speaker, its skills tagged and sized in the plan's graph. */
async function italianPlan({
  items,
  skills,
  user,
  visibility = "public",
}: {
  items: ItemSpec[];
  skills: { lessons: number; level: CefrLevel }[];
  user?: User;
  visibility?: LibraryVisibility;
}) {
  const [learner, course, units, skillRows] = await Promise.all([
    user ?? userFixture(),
    courseFixture({ format: "language", language: "pt", visibility }),
    Promise.all(
      ["Al bar", "In stazione", "Al lavoro"].map((title, index) =>
        libraryChapterFixture({
          language: "pt",
          objectives: [`Consigo a parte ${index + 1}`],
          targetLanguage: "it",
          title,
        }),
      ),
    ),
    Promise.all(
      skills.map((spec) =>
        skillFixture({ cefrLevel: spec.level, language: "pt", level: BANDS[spec.level] }),
      ),
    ),
  ]);

  const lessons = await Promise.all(
    items.map(async (spec) =>
      spec.standIn === undefined
        ? libraryLessonFixture({
            homeChapterId: units[spec.unit ?? 0]?.id,
            language: "pt",
            targetLanguage: "it",
          })
        : null,
    ),
  );

  await Promise.all([
    ...units.map((unit, position) =>
      courseChapterFixture({ chapterId: unit.id, courseId: course.id, position }),
    ),
    ...items.flatMap((spec, position) => {
      const lesson = lessons[position];

      return lesson
        ? [
            chapterLessonFixture({
              chapterId: lesson.homeChapterId ?? "",
              lessonId: lesson.id,
              position,
            }),
            lessonSkillFixture({ lessonId: lesson.id, skillId: skillRows[spec.skill]?.id ?? "" }),
          ]
        : [];
    }),
  ]);

  const goal = await goalFixture({
    kind: "language",
    language: "pt",
    primaryCourseId: course.id,
    targetLanguage: "it",
    timezone: TIME_ZONE,
    title: "Italiano",
    userId: learner.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      skills: plannedSkills(
        skillRows.map((skill, index) => ({ ...skill, lessons: skills[index]?.lessons ?? 1 })),
      ),
    },
    items: items.map((spec, index) => {
      const status = spec.status ?? "todo";

      return {
        chapterId: spec.standIn === undefined ? (units[spec.unit ?? 0]?.id ?? null) : null,
        completedAt: status === "todo" ? null : (spec.completedAt ?? EARLIER),
        lessonId: lessons[index]?.id ?? null,
        lessons: spec.standIn ?? null,
        minutes: 4,
        skillId: skillRows[spec.skill]?.id ?? null,
        status,
      };
    }),
  });

  return { goal, plan, skills: skillRows, units, user: learner };
}

type ItalianPlan = Awaited<ReturnType<typeof italianPlan>>;

async function finishLesson({ plan, user }: ItalianPlan, index: number, now = new Date()) {
  const lessonId = plan.items[index]?.lessonId;

  if (!lessonId) {
    throw new Error("Expected a written lesson");
  }

  await writeLearnerChange({ userId: user.id }, (tx) =>
    completeLessonPlanItems(tx, { lessonId, now, userId: user.id }),
  );
}

/** Two A1 skills, the second left out of the plan, so a test-out adds it as a stand-in. */
function leftOutSkillPlan(leftOutLessons: number) {
  return italianPlan({
    items: [{ skill: 0, status: "done" }, { skill: 0, status: "done" }, { skill: 0 }],
    skills: [
      { lessons: 3, level: "A1" },
      { lessons: leftOutLessons, level: "A1" },
    ],
  });
}

function listLevelCertificates(userId: string) {
  return prisma.certificate.findMany({
    orderBy: { createdAt: "asc" },
    where: { kind: "languageLevel", userId },
  });
}

describe("language level certificates", () => {
  it("awards B1 when its last lesson finishes, with that level's facts and units", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0, status: "done" },
        { skill: 0, status: "done" },
        { skill: 0, unit: 1 },
        { skill: 1, unit: 1 },
        { skill: 1, unit: 2 },
      ],
      skills: [
        { lessons: 4, level: "B1" },
        { lessons: 4, level: "B2" },
      ],
    });

    await finishLesson(fixture, 1);
    await expect(listLevelCertificates(fixture.user.id)).resolves.toStrictEqual([]);

    await finishLesson(fixture, 2, new Date("2026-11-03T01:30:00Z"));

    const [certificate, ...more] = await listLevelCertificates(fixture.user.id);

    expect(more).toStrictEqual([]);

    expect(certificate).toMatchObject({
      completedOn: new Date("2026-11-02T00:00:00Z"),
      details: { canDo: ["Consigo a parte 1"], lessonsStudied: 3, minutes: 12 },
      goalId: fixture.goal.id,
      key: "it:B1",
      language: "pt",
      level: "B1",
      targetLanguage: "it",
    });
  });

  it("awards a level finished before with the learner's next lesson, dated by its own last one", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0, status: "done" },
        { skill: 0, status: "done" },
        { skill: 1, unit: 1 },
        { skill: 1, unit: 1 },
      ],
      skills: [
        { lessons: 2, level: "A1" },
        { lessons: 2, level: "A2" },
      ],
    });

    await finishLesson(fixture, 2);
    await finishLesson(fixture, 3);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toMatchObject([
      { completedOn: new Date("2026-10-20T00:00:00Z"), key: "it:A1" },
      { key: "it:A2" },
    ]);
  });

  it("awards nothing for a dated plan that kept and finished a third of each skill", async () => {
    const fixture = await italianPlan({
      items: [{ skill: 0, status: "done" }, { skill: 0 }, { skill: 1 }],
      skills: [
        { lessons: 6, level: "A1" },
        { lessons: 6, level: "A1" },
      ],
    });

    await finishLesson(fixture, 1);
    await finishLesson(fixture, 2);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toStrictEqual([]);
  });

  it("awards no level for a goal built on a private course", async () => {
    const fixture = await italianPlan({
      items: [{ skill: 0, status: "done" }, { skill: 0 }],
      skills: [{ lessons: 2, level: "A1" }],
      visibility: "private",
    });

    await finishLesson(fixture, 1);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toStrictEqual([]);
  });

  it("judges two goals for one language each on its own plan, and awards the level once", async () => {
    const trimmed = await italianPlan({
      items: [{ skill: 0, status: "done" }, { skill: 0 }],
      skills: [{ lessons: 10, level: "A1" }],
    });

    const whole = await italianPlan({
      items: [{ skill: 0, status: "done" }, { skill: 0 }, { skill: 0 }],
      skills: [{ lessons: 3, level: "A1" }],
      user: trimmed.user,
    });

    await finishLesson(trimmed, 1);
    await expect(listLevelCertificates(trimmed.user.id)).resolves.toStrictEqual([]);

    await finishLesson(whole, 1);
    await finishLesson(whole, 2);

    await expect(listLevelCertificates(trimmed.user.id)).resolves.toMatchObject([
      { goalId: whole.goal.id, key: "it:A1" },
    ]);
  });

  it("awards on a test-out, measuring a stand-in it adds by its skill's size", async () => {
    const [small, large] = await Promise.all([leftOutSkillPlan(1), leftOutSkillPlan(4)]);

    await Promise.all(
      [small, large].map(({ goal, plan, skills, user }) => {
        const todo = plan.items.filter((item) => item.status === "todo" && item.kind === "lesson");
        const [taught, leftOut] = skills;

        return writeLearnerChange({ userId: user.id }, (tx) =>
          testOutKnownPlanItems(tx, {
            goalId: goal.id,
            items: todo.map((item) => ({ ...item, skillIds: [item.skillId ?? ""] })),
            knownSkillIds: new Set([taught?.id ?? "", leftOut?.id ?? ""]),
            placedSkills: [{ id: leftOut?.id ?? "", phase: 0 }],
            testedOutAt: new Date(),
            timeZone: TIME_ZONE,
          }),
        );
      }),
    );

    await expect(listLevelCertificates(small.user.id)).resolves.toMatchObject([{ key: "it:A1" }]);
    await expect(listLevelCertificates(large.user.id)).resolves.toStrictEqual([]);
  });
});

/** A studied A1 skill of one lesson and a tested-out one of three, then an A2 lesson. */
function mergedSkillPlan() {
  return italianPlan({
    items: [
      { skill: 0, status: "done" },
      { skill: 1, standIn: 3, status: "testedOut" },
      { skill: 2, unit: 1 },
    ],
    skills: [
      { lessons: 1, level: "A1" },
      { lessons: 3, level: "A1" },
      { lessons: 1, level: "A2" },
    ],
  });
}

/** Merges the plan's first skill into its second, then finishes its third item. */
async function mergeAndFinish(fixture: ItalianPlan) {
  const [duplicate, survivor] = fixture.skills;
  await mergeSkills({ duplicateId: duplicate?.id ?? "", survivorId: survivor?.id ?? "" });
  await finishLesson(fixture, 2);
}

async function mergeIntoNewA1Skill(duplicateId: string) {
  const survivor = await skillFixture({ cefrLevel: "A1", language: "pt", level: "beginner" });
  await mergeSkills({ duplicateId, survivorId: survivor.id });
}

describe("a plan whose skill an admin merged", () => {
  it("measures the merged skill once, at its size in the plan's graph", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0, status: "done" },
        { skill: 0, status: "testedOut" },
        { skill: 1, unit: 1 },
      ],
      skills: [
        { lessons: 2, level: "A1" },
        { lessons: 1, level: "A2" },
      ],
    });

    await mergeIntoNewA1Skill(fixture.skills[0]?.id ?? "");
    await finishLesson(fixture, 2);

    const certificates = await listLevelCertificates(fixture.user.id);

    expect(certificates.map((row) => row.key).toSorted()).toStrictEqual(["it:A1", "it:A2"]);
  });

  it("keeps a merged skill's tested-out lessons for a level and a course", async () => {
    const [level, course] = await Promise.all([mergedSkillPlan(), mergedSkillPlan()]);

    await asCourseGoal(course);
    await mergeAndFinish(level);
    await mergeAndFinish(course);

    await expect(listLevelCertificates(level.user.id)).resolves.toMatchObject([{ key: "it:A2" }]);

    mockSession(course.user.id);

    await expect(claimCourseCertificate(course.goal.id)).resolves.toStrictEqual({
      status: "notFinished",
    });
  });

  it("reads the level of the skill it merged into, not of the untagged one it replaced", async () => {
    const fixture = await italianPlan({
      items: [{ skill: 0, status: "done" }, { skill: 0 }],
      skills: [{ lessons: 2, level: "A1" }],
    });

    const duplicateId = fixture.skills[0]?.id ?? "";

    await prisma.skill.update({ data: { cefrLevel: null }, where: { id: duplicateId } });
    await mergeIntoNewA1Skill(duplicateId);
    await finishLesson(fixture, 1);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toMatchObject([{ key: "it:A1" }]);
  });
});

async function updateGraphSkill(
  { plan, skills }: ItalianPlan,
  { attrs, skill }: { attrs: Partial<PlanGraphSkill>; skill: number },
) {
  const { graph } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  const stored = parsePlanGraph(graph);
  const skillId = skills[skill]?.id;

  await prisma.plan.update({
    data: {
      graph: {
        ...stored,
        skills: stored.skills.map((entry) =>
          entry.skillId === skillId ? { ...entry, ...attrs } : entry,
        ),
      },
    },
    where: { id: plan.id },
  });
}

/** Library lessons of a skill in the plan's first unit that the plan holds no item for. */
async function writeLessons(
  { skills, units }: ItalianPlan,
  { count, skill }: { count: number; skill: number },
) {
  const chapterId = units[0]?.id ?? "";

  await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        homeChapterId: chapterId,
        language: "pt",
        targetLanguage: "it",
      });

      await Promise.all([
        chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 100 + index }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skills[skill]?.id ?? "" }),
      ]);
    }),
  );
}

/** Tests out a skill's lessons left to do the way a test-out does, without its award call. */
function markTestedOut({ plan, skills }: ItalianPlan, skill: number) {
  return prisma.planItem.updateMany({
    data: { completedAt: new Date(), status: "testedOut" },
    where: { planId: plan.id, skillId: skills[skill]?.id, status: "todo" },
  });
}

/** The same plan as a learn goal on a public core course, its challenge won. */
async function asCourseGoal({ goal, plan }: ItalianPlan) {
  await Promise.all([
    prisma.goal.update({ data: { kind: "learn" }, where: { id: goal.id } }),
    prisma.course.update({ data: { format: "core" }, where: { id: goal.primaryCourseId ?? "" } }),
    prisma.planItem.updateMany({
      data: { completedAt: new Date(), status: "done" },
      where: { kind: "boss", planId: plan.id },
    }),
  ]);
}

type SixLessonSkill = { estimate: number; outlined?: boolean; studied: number };

/** Six written lessons of an A1 skill, a share of them studied and the rest tested out, then an A2 lesson. */
async function sixLessonSkillPlan({ estimate, outlined = true, studied }: SixLessonSkill) {
  const fixture = await italianPlan({
    items: [
      ...Array.from({ length: 6 }, (_, index) => ({
        skill: 0,
        status: index < studied ? ("done" as const) : ("todo" as const),
      })),
      { skill: 1, unit: 1 },
    ],
    skills: [
      { lessons: estimate, level: "A1" },
      { lessons: 1, level: "A2" },
    ],
  });

  if (outlined) {
    await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
  }

  await markTestedOut(fixture, 0);
  return fixture;
}

const OUTLINED_CASES = [false, true].flatMap((replanned) => [
  { earned: true, estimate: 30, replanned, studied: 3 },
  { earned: false, estimate: 2, replanned, studied: 2 },
]);

describe("a skill's full size", () => {
  it.each(OUTLINED_CASES)(
    "measures an outlined skill by its six written lessons, not its estimate of $estimate ($studied studied, re-planned: $replanned)",
    async ({ earned, estimate, replanned, studied }) => {
      const fixture = await sixLessonSkillPlan({ estimate, studied });

      if (replanned) {
        await refreshGoalPlan({ goalId: fixture.goal.id });
      }

      await finishLesson(fixture, 6);

      const certificates = await listLevelCertificates(fixture.user.id);

      expect(certificates.some((row) => row.key === "it:A1")).toBe(earned);
    },
  );

  it.each(OUTLINED_CASES)(
    "measures a course's outlined skill by its six written lessons, not its estimate of $estimate ($studied studied, re-planned: $replanned)",
    async ({ earned, estimate, replanned, studied }) => {
      const fixture = await sixLessonSkillPlan({ estimate, studied });
      await asCourseGoal(fixture);

      if (replanned) {
        await refreshGoalPlan({ goalId: fixture.goal.id });
      }

      await finishLesson(fixture, 6);
      mockSession(fixture.user.id);

      await expect(claimCourseCertificate(fixture.goal.id)).resolves.toMatchObject({
        status: earned ? "ready" : "notFinished",
      });
    },
  );

  it("measures a skill not outlined by its written lessons once more are written than estimated", async () => {
    const fixture = await sixLessonSkillPlan({ estimate: 2, outlined: false, studied: 2 });

    await finishLesson(fixture, 6);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toMatchObject([{ key: "it:A2" }]);
  });

  it("keeps a skill a dated plan trimmed to its core at its full size when the core is tested out", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0, status: "done" },
        { skill: 0, status: "done" },
        { skill: 1 },
        { skill: 1 },
      ],
      skills: [
        { lessons: 2, level: "A1" },
        { lessons: 6, level: "A1" },
      ],
    });

    await Promise.all([
      updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 1 }),
      writeLessons(fixture, { count: 4, skill: 1 }),
    ]);

    const knownId = fixture.skills[1]?.id ?? "";
    const core = fixture.plan.items.filter((item) => item.skillId === knownId);

    await writeLearnerChange({ userId: fixture.user.id }, (tx) =>
      testOutKnownPlanItems(tx, {
        goalId: fixture.goal.id,
        items: core.map((item) => ({ ...item, skillIds: [knownId] })),
        knownSkillIds: new Set([knownId]),
        testedOutAt: new Date(),
        timeZone: TIME_ZONE,
      }),
    );

    await expect(listLevelCertificates(fixture.user.id)).resolves.toStrictEqual([]);
  });

  it("counts nothing for a skill in an area the learner removed from the plan", async () => {
    const fixture = await italianPlan({
      items: [{ skill: 0, status: "done" }, { skill: 0 }],
      skills: [
        { lessons: 2, level: "A1" },
        { lessons: 10, level: "A1" },
      ],
    });

    await updateGraphSkill(fixture, { attrs: { area: "Al bar" }, skill: 0 });
    await updateGraphSkill(fixture, { attrs: { area: "Al lavoro" }, skill: 1 });

    await prisma.plan.update({
      data: { settings: { skippedAreas: ["Al lavoro"] } },
      where: { id: fixture.plan.id },
    });

    await finishLesson(fixture, 1);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toMatchObject([{ key: "it:A1" }]);
  });
});

/** Tests out every lesson left to do of a skill, as the learner's plan lists them. */
async function testOutSkill({ goal, skills, user }: ItalianPlan, skill: number) {
  const skillId = skills[skill]?.id ?? "";
  const { items } = await loadGoalPlan(goal.id);

  await writeLearnerChange({ userId: user.id }, (tx) =>
    testOutKnownPlanItems(tx, {
      goalId: goal.id,
      items,
      knownSkillIds: new Set([skillId]),
      testedOutAt: new Date(),
      timeZone: TIME_ZONE,
    }),
  );
}

/** Moves the plan's second unit to a course of its own and scopes each skill to its course. */
async function splitCourses(fixture: ItalianPlan, format: "core" | "language") {
  const [other] = await Promise.all([
    courseFixture({ format, language: "pt" }),
    prisma.courseChapter.deleteMany({
      where: { chapterId: fixture.units[1]?.id, courseId: fixture.goal.primaryCourseId ?? "" },
    }),
  ]);

  await courseChapterFixture({ chapterId: fixture.units[1]?.id ?? "", courseId: other.id });

  const primary = fixture.goal.primaryCourseId ?? "";
  await updateGraphSkill(fixture, { attrs: { courseIds: [primary], outlined: true }, skill: 0 });
  await updateGraphSkill(fixture, { attrs: { courseIds: [other.id], outlined: true }, skill: 1 });
}

/** One studied A1 lesson in the primary course, five tested out in another, then an A2 lesson. */
function twoCourseSkillPlan() {
  return italianPlan({
    items: [
      { skill: 0, status: "done" },
      ...Array.from({ length: 5 }, () => ({ skill: 1, status: "testedOut" as const, unit: 1 })),
      { skill: 2, unit: 2 },
    ],
    skills: [
      { lessons: 1, level: "A1" },
      { lessons: 5, level: "A1" },
      { lessons: 1, level: "A2" },
    ],
  });
}

async function removeArea({ goal, user }: ItalianPlan, area: string) {
  mockSession(user.id);

  await expect(
    changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: [area], kind: "skipAreas" }] },
      trackAnalytics: false,
    }),
  ).resolves.toMatchObject({ status: "applied" });
}

describe("a skill's size through re-plans and merges", () => {
  it("keeps a level's lessons when a re-plan shares its written lessons out again after a test-out", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0, status: "done" },
        { skill: 0 },
        { skill: 0 },
        ...Array.from({ length: 3 }, () => ({ skill: 1 })),
      ],
      skills: [
        { lessons: 3, level: "A1" },
        { lessons: 3, level: "A2" },
      ],
    });

    const [a1, a2] = fixture.skills;

    await Promise.all(
      fixture.plan.items.map((item) =>
        lessonSkillFixture({
          lessonId: item.lessonId ?? "",
          skillId: (item.skillId === a1?.id ? a2?.id : a1?.id) ?? "",
        }),
      ),
    );

    await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
    await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 1 });

    await prisma.goal.update({
      data: { details: { level: "none", targetLevel: "A1" } },
      where: { id: fixture.goal.id },
    });

    await refreshGoalPlan({ goalId: fixture.goal.id });
    await testOutSkill(fixture, 0);
    await refreshGoalPlan({ goalId: fixture.goal.id });

    const next = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { kind: "lesson", lessonId: { not: null }, planId: fixture.plan.id, status: "todo" },
    });

    await writeLearnerChange({ userId: fixture.user.id }, (tx) =>
      completeLessonPlanItems(tx, {
        lessonId: next.lessonId ?? "",
        now: new Date(),
        userId: fixture.user.id,
      }),
    );

    const certificates = await listLevelCertificates(fixture.user.id);

    expect(certificates.map((row) => row.key)).not.toContain("it:A1");
  });

  it.each([false, true])(
    "keeps a merged skill's lessons from another course (re-planned: %s)",
    async (replanned) => {
      const fixture = await twoCourseSkillPlan();
      await splitCourses(fixture, "language");

      await mergeSkills({
        duplicateId: fixture.skills[1]?.id ?? "",
        survivorId: fixture.skills[0]?.id ?? "",
      });

      if (replanned) {
        await refreshGoalPlan({ goalId: fixture.goal.id });
      }

      await finishLesson(fixture, 6);

      await expect(listLevelCertificates(fixture.user.id)).resolves.toMatchObject([
        { key: "it:A2" },
      ]);
    },
  );

  it("certifies no plan below half after a merge drops one skill's course", async () => {
    const fixture = await twoCourseSkillPlan();
    const primaryCourseId = fixture.goal.primaryCourseId ?? "";

    await asCourseGoal(fixture);
    await splitCourses(fixture, "core");

    await Promise.all([
      prisma.goal.update({ data: { primaryCourseId: null }, where: { id: fixture.goal.id } }),
      prisma.chapter.update({
        data: { homeCourseId: primaryCourseId },
        where: { id: fixture.units[0]?.id ?? "" },
      }),
    ]);

    await mergeSkills({
      duplicateId: fixture.skills[1]?.id ?? "",
      survivorId: fixture.skills[0]?.id ?? "",
    });

    await refreshGoalPlan({ goalId: fixture.goal.id });
    await finishLesson(fixture, 6);
    mockSession(fixture.user.id);

    await expect(claimCourseCertificate(fixture.goal.id)).resolves.toStrictEqual({
      status: "notFinished",
    });
  });

  it("keeps a kept skill's tested-out lessons when a removed one merges into it", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 1, status: "done" },
        { skill: 1, standIn: 9, status: "testedOut" },
        { skill: 2, unit: 1 },
      ],
      skills: [
        { lessons: 2, level: "A1" },
        { lessons: 10, level: "A1" },
        { lessons: 1, level: "A2" },
      ],
    });

    await updateGraphSkill(fixture, { attrs: { area: "Removed" }, skill: 0 });
    await updateGraphSkill(fixture, { attrs: { area: "Kept" }, skill: 1 });
    await removeArea(fixture, "Removed");

    await mergeSkills({
      duplicateId: fixture.skills[0]?.id ?? "",
      survivorId: fixture.skills[1]?.id ?? "",
    });

    await finishLesson(fixture, 2);

    await expect(listLevelCertificates(fixture.user.id)).resolves.toMatchObject([{ key: "it:A2" }]);
  });
});

/** Links each of the plan's written lessons to its other skill too, so every lesson teaches both. */
async function shareLessons({ plan, skills }: ItalianPlan) {
  const [first, second] = skills;

  await Promise.all(
    plan.items.flatMap((item) =>
      item.lessonId
        ? lessonSkillFixture({
            lessonId: item.lessonId,
            skillId: (item.skillId === first?.id ? second?.id : first?.id) ?? "",
          })
        : [],
    ),
  );
}

async function finishLessonId({ user }: ItalianPlan, lessonId: string) {
  await writeLearnerChange({ userId: user.id }, (tx) =>
    completeLessonPlanItems(tx, { lessonId, now: new Date(), userId: user.id }),
  );
}

function listTodoLessons({ plan }: ItalianPlan) {
  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", lessonId: { not: null }, planId: plan.id, status: "todo" },
  });
}

async function listLevelKeys(userId: string) {
  const certificates = await listLevelCertificates(userId);
  return certificates.map((row) => row.key);
}

async function isCertified({ goal, user }: ItalianPlan, course: boolean) {
  if (!course) {
    const keys = await listLevelKeys(user.id);
    return keys.includes("it:A1");
  }

  mockSession(user.id);
  const claimed = await claimCourseCertificate(goal.id);
  return claimed.status === "ready";
}

/** Two outlined skills whose eight written lessons each teach both, re-planned from a beginner's start. */
async function sharedLessonPlan(levels: [CefrLevel, CefrLevel]) {
  const fixture = await italianPlan({
    items: [
      ...Array.from({ length: 4 }, () => ({ skill: 0 })),
      ...Array.from({ length: 4 }, () => ({ skill: 1 })),
    ],
    skills: levels.map((level) => ({ lessons: 4, level })),
  });

  await shareLessons(fixture);
  await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
  await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 1 });

  await prisma.goal.update({
    data: { details: { level: "none", targetLevel: "A1" } },
    where: { id: fixture.goal.id },
  });

  await refreshGoalPlan({ goalId: fixture.goal.id });
  return fixture;
}

describe("a level's size, each written lesson counted once", () => {
  it.each([
    { course: false, earned: true, estimate: 30, studied: 3 },
    { course: false, earned: false, estimate: 2, studied: 1 },
    { course: true, earned: true, estimate: 30, studied: 3 },
  ])(
    "measures six outlined lessons through a re-plan and a test-out, not an estimate of $estimate ($studied studied, course: $course)",
    async ({ course, earned, estimate, studied }) => {
      const fixture = await italianPlan({
        items: Array.from({ length: 6 }, (_, index) => ({
          skill: 0,
          status: index < studied ? ("done" as const) : ("todo" as const),
        })),
        skills: [{ lessons: estimate, level: "A1" }],
      });

      if (course) {
        await asCourseGoal(fixture);
      }

      await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
      await refreshGoalPlan({ goalId: fixture.goal.id });
      await testOutSkill(fixture, 0);

      await expect(isCertified(fixture, course)).resolves.toBe(earned);
    },
  );

  it.each([["A1", "A1"] as const, ["A1", "A2"] as const])(
    "counts eight lessons that teach a %s and a %s skill once each, at the lower level, through a test-out and a re-plan",
    async (...levels) => {
      const fixture = await sharedLessonPlan(levels);

      await testOutSkill(fixture, 0);
      await refreshGoalPlan({ goalId: fixture.goal.id });
      const todo = await listTodoLessons(fixture);

      expect(todo).toHaveLength(4);

      for (const item of todo) {
        // oxlint-disable-next-line no-await-in-loop -- A learner finishes one lesson at a time.
        await finishLessonId(fixture, item.lessonId ?? "");
      }

      await expect(listLevelKeys(fixture.user.id)).resolves.toStrictEqual(["it:A1"]);
    },
  );

  it.each([5, 10, 15, 20])(
    "earns no level below half for a dated plan whose lessons teach two levels, at %s minutes a day",
    async (dailyMinutes) => {
      const fixture = await italianPlan({
        items: [
          ...Array.from({ length: 3 }, () => ({ skill: 0 })),
          ...Array.from({ length: 3 }, () => ({ skill: 1 })),
        ],
        skills: [
          { lessons: 3, level: "A1" },
          { lessons: 3, level: "A2" },
        ],
      });

      await shareLessons(fixture);
      await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
      await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 1 });
      await prisma.planItem.deleteMany({ where: { planId: fixture.plan.id } });

      await prisma.goal.update({
        data: {
          dailyMinutes,
          details: { level: "none", targetLevel: "A1" },
          targetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        where: { id: fixture.goal.id },
      });

      await refreshGoalPlan({ goalId: fixture.goal.id });
      const [first] = await listTodoLessons(fixture);

      if (first?.lessonId) {
        await finishLessonId(fixture, first.lessonId);
        await testOutSkill(fixture, 0);
        await refreshGoalPlan({ goalId: fixture.goal.id });
      }

      const [next] = await listTodoLessons(fixture);

      if (next?.lessonId) {
        await finishLessonId(fixture, next.lessonId);
      }

      await expect(listLevelKeys(fixture.user.id)).resolves.not.toContain("it:A1");
    },
  );

  it.each([false, true])(
    "leaves out the lessons of an area removed after its test-out (course: %s)",
    async (course) => {
      const fixture = await italianPlan({
        items: [
          { skill: 0, status: "done" },
          { skill: 0 },
          ...Array.from({ length: 10 }, () => ({ skill: 1 })),
        ],
        skills: [
          { lessons: 2, level: "A1" },
          { lessons: 10, level: "A1" },
        ],
      });

      await updateGraphSkill(fixture, { attrs: { area: "Kept", outlined: true }, skill: 0 });
      await updateGraphSkill(fixture, { attrs: { area: "Removed", outlined: true }, skill: 1 });

      if (course) {
        await asCourseGoal(fixture);
      }

      await testOutSkill(fixture, 1);
      await removeArea(fixture, "Removed");
      await finishLesson(fixture, 1);

      await expect(isCertified(fixture, course)).resolves.toBe(true);
    },
  );

  it("leaves out lessons held back for good", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0 },
        ...Array.from({ length: 5 }, () => ({ skill: 0, status: "skipped" as const })),
      ],
      skills: [{ lessons: 6, level: "A1" }],
    });

    await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });

    await prisma.lesson.updateMany({
      data: { setAsideAt: new Date() },
      where: { id: { in: fixture.plan.items.slice(1).flatMap((item) => item.lessonId ?? []) } },
    });

    await finishLesson(fixture, 0);

    await expect(listLevelKeys(fixture.user.id)).resolves.toStrictEqual(["it:A1"]);
  });

  it.each([
    { earned: false, studied: 2 },
    { earned: true, studied: 3 },
  ])(
    "measures six written lessons, not a tested-out stand-in a re-plan rewrote ($studied studied)",
    async ({ earned, studied }) => {
      const fixture = await italianPlan({
        items: [
          ...Array.from({ length: studied }, () => ({ skill: 0, status: "done" as const })),
          { skill: 0, standIn: 6 - studied, status: "testedOut" },
          { skill: 1, unit: 1 },
        ],
        skills: [
          { lessons: 6, level: "A1" },
          { lessons: 1, level: "A2" },
        ],
      });

      await writeLessons(fixture, { count: 6 - studied, skill: 0 });
      await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
      await refreshGoalPlan({ goalId: fixture.goal.id });
      await finishLesson(fixture, studied + 1);

      await expect(isCertified(fixture, false)).resolves.toBe(earned);
    },
  );

  it("earns a level after bringing its tested-out lessons back and studying them", async () => {
    const fixture = await italianPlan({
      items: [...Array.from({ length: 6 }, () => ({ skill: 0 })), { skill: 1, unit: 1 }],
      skills: [
        { lessons: 30, level: "A1" },
        { lessons: 1, level: "A2" },
      ],
    });

    await updateGraphSkill(fixture, { attrs: { outlined: true }, skill: 0 });
    await testOutSkill(fixture, 0);

    await bringBackMissedLessons({
      goalId: fixture.goal.id,
      now: new Date(),
      skillIds: [fixture.skills[0]?.id ?? ""],
      timeZone: TIME_ZONE,
    });

    for (const index of [0, 1, 2, 3, 4, 5]) {
      // oxlint-disable-next-line no-await-in-loop -- A learner finishes one lesson at a time.
      await finishLesson(fixture, index);
    }

    await expect(listLevelKeys(fixture.user.id)).resolves.toContain("it:A1");
  });
});

const TEST_LEVELS = CEFR_LEVELS.slice(0, 5);

const BANK: LevelTestBank = {
  questions: TEST_LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 1,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d"],
        passage: `${skill} passage ${level}`,
        question: "O que diz a mensagem?",
        skill,
      })),
    ),
  ),
  speaking: TEST_LEVELS.map((level) => ({ level, sentence: `Say ${level}`, translation: "Diga" })),
};

type StoredAnswer = { answerIndex: number; id: string };

function answers(skill: "listening" | "reading"): StoredAnswer[] {
  return ["A2", "B1", "B2"].map((level, index) => ({
    answerIndex: 1,
    id: `${skill}-${level}-${index % 2}`,
  }));
}

async function takeTest({
  goal,
  levelAnswers,
  targetLanguage,
}: {
  goal: Goal;
  levelAnswers: StoredAnswer[];
  targetLanguage: string;
}) {
  await prisma.languageLevelTest.upsert({
    create: {
      content: BANK,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage,
    },
    update: { content: BANK },
    where: { languagePair: { language: "pt", targetLanguage } },
  });

  await prisma.goal.update({
    data: {
      details: {
        ...(goal.details as object),
        levelTest: { answers: levelAnswers, speaking: null },
      },
    },
    where: { id: goal.id },
  });

  mockSession(goal.userId);
}

async function testTaker(levelAnswers: StoredAnswer[]) {
  const { goal, user } = await languageGoalFixture();
  await takeTest({ goal, levelAnswers, targetLanguage: "en" });
  return { goal, user };
}

describe("the level test", () => {
  it("keeps the stored test and its result when a learner sends their own", async () => {
    const { goal } = await testTaker([]);
    const forged = [...answers("reading"), ...answers("listening")];

    await updateGoal({
      goalId: goal.id,
      input: {
        details: {
          levelTest: { answers: forged, speaking: null },
          skillLevels: { listening: "C1", reading: "C1" },
        },
      },
    });

    const stored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(stored.details).toMatchObject({ levelTest: { answers: [] } });
    expect(stored.details).not.toHaveProperty("skillLevels");
  });

  it("leaves skills lessons raised as they were when another goal's test finishes", async () => {
    const { goal, user } = await testTaker([]);

    await prisma.languageSkillLevel.create({
      data: {
        language: "en",
        raisedAt: new Date(),
        score: 0.5,
        skill: "reading",
        startScore: 0,
        userId: user.id,
      },
    });

    await prisma.goal.update({
      data: { details: { ...(goal.details as object), level: "B1" } },
      where: { id: goal.id },
    });

    await finishLanguageLevelTest(goal.id);

    await expect(
      prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId: user.id } }),
    ).resolves.toMatchObject([
      { score: 0.5, skill: "reading", startScore: 0 },
      { score: 2, skill: "listening", startScore: 2 },
    ]);
  });
});

describe("a learner the level test placed high", () => {
  it("earns no level for the few lessons left after testing out most of them", async () => {
    const fixture = await italianPlan({
      items: [
        { skill: 0 },
        { skill: 0 },
        { skill: 1 },
        { skill: 1 },
        ...Array.from({ length: 4 }, () => ({ skill: 2, unit: 1 })),
        { skill: 3, unit: 2 },
        { skill: 3, unit: 2 },
      ],
      skills: [
        { lessons: 2, level: "A1" },
        { lessons: 2, level: "A2" },
        { lessons: 4, level: "B1" },
        { lessons: 2, level: "B1" },
      ],
    });

    const { goal, plan, skills, user } = fixture;
    const levelAnswers = [...answers("reading"), ...answers("listening")];

    await takeTest({ goal, levelAnswers, targetLanguage: "it" });
    await finishLanguageLevelTest(goal.id);

    const placed = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(placed.details).toMatchObject({ level: "B1+" });

    const knownId = skills[2]?.id ?? "";
    const known = plan.items.filter((item) => item.skillId === knownId);

    await writeLearnerChange({ userId: user.id }, (tx) =>
      testOutKnownPlanItems(tx, {
        goalId: goal.id,
        items: known.map((item) => ({ ...item, skillIds: [knownId] })),
        knownSkillIds: new Set([knownId]),
        testedOutAt: new Date(),
        timeZone: TIME_ZONE,
      }),
    );

    await refreshGoalPlan({ goalId: goal.id });

    await finishLesson(fixture, 8);
    await finishLesson(fixture, 9);

    await expect(listLevelCertificates(user.id)).resolves.toStrictEqual([]);
  });
});
