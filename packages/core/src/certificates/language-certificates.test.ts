import {
  type CourseLevel,
  type LibraryVisibility,
  type PlanItem,
  type User,
  prisma,
} from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { CEFR_LEVELS, type CefrLevel } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { finishLanguageLevelTest } from "../language/level-test/finish-language-level-test";
import { type LevelTestBank } from "../language/level-test/level-test-contract";
import { testOutKnownPlanItems } from "../learner/_utils/test-out-known-plan-items";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { completeLessonPlanItems } from "../sessions/_utils/plan-items";

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

async function testTaker(levelAnswers: StoredAnswer[]) {
  await prisma.languageLevelTest.upsert({
    create: {
      content: BANK,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content: BANK },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });

  const { goal, user } = await languageGoalFixture();

  await prisma.goal.update({
    data: {
      details: {
        ...(goal.details as object),
        levelTest: { answers: levelAnswers, speaking: null },
      },
    },
    where: { id: goal.id },
  });

  mockSession(user.id);
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
