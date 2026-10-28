import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { getSyllabusView } from "./get-syllabus-view";

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

function noticeStructure() {
  return {
    formats: [],
    mock: null,
    rules: [],
    subjects: [
      {
        citation,
        group: "Conhecimentos básicos (P1)",
        name: "Língua Portuguesa",
        questions: 30,
        topics: ["Ortografia", "Coesão textual"],
        weight: null,
      },
      {
        citation,
        group: "Conhecimentos específicos (P2)",
        name: "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados",
        questions: 10,
        topics: ["Princípios fundamentais"],
        weight: null,
      },
    ],
  };
}

async function signedInExamLearner({ topics }: { topics: boolean }) {
  const user = await userFixture();

  const [blueprint, portugueseCourse, lawCourse, orthography, cohesion, principles, lesson] =
    await Promise.all([
      examBlueprintFixture({
        edition: {
          check: null,
          citations: [],
          dates: [],
          noticeUrl: "https://example.com/edital.pdf",
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2026,
        },
        structure: noticeStructure(),
      }),
      courseFixture({ imageUrl: "https://example.com/pt.webp", title: "Língua Portuguesa" }),
      courseFixture({ imageUrl: "https://example.com/dc.webp", title: "Direito Constitucional" }),
      skillFixture({ name: "Aplicar a ortografia" }),
      skillFixture({ name: "Analisar a coesão" }),
      skillFixture({ name: "Aplicar os princípios" }),
      libraryLessonFixture({ title: "Coesão sem skill no item" }),
    ]);

  const [goal, portugueseChapter, lawChapter] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", title: "Câmara", userId: user.id }),
    libraryChapterFixture({ title: "Grafia e coesão" }),
    libraryChapterFixture({ title: "A Constituição de 1988" }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: cohesion.id }),
  ]);

  const graphSkill = (
    skill: { id: string; name: string },
    area: string,
    courseId: string,
    topic: string,
  ) => ({
    area,
    courseIds: [courseId],
    lessons: 2,
    name: skill.name,
    phase: 0,
    skillId: skill.id,
    ...(topics ? { topics: [topic] } : {}),
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ name: "Fundamentos" }],
      skills: [
        graphSkill(orthography, "Língua Portuguesa", portugueseCourse.id, "Ortografia"),
        graphSkill(cohesion, "Língua Portuguesa", portugueseCourse.id, "Coesão textual"),
        graphSkill(principles, "Direito Constitucional", lawCourse.id, "Princípios fundamentais"),
      ],
    },
  });

  await Promise.all([
    planItemFixture({
      chapterId: portugueseChapter.id,
      planId: plan.id,
      position: 0,
      scheduledFor: new Date("2026-10-06T00:00:00.000Z"),
      skillId: orthography.id,
      status: "done",
    }),
    planItemFixture({
      chapterId: lawChapter.id,
      planId: plan.id,
      position: 1,
      scheduledFor: new Date("2026-10-06T00:00:00.000Z"),
      skillId: principles.id,
    }),
    planItemFixture({
      chapterId: portugueseChapter.id,
      lessonId: lesson.id,
      planId: plan.id,
      position: 2,
      scheduledFor: new Date("2026-10-07T00:00:00.000Z"),
    }),
    planItemFixture({ chapterId: lawChapter.id, kind: "chapter", planId: plan.id, position: 3 }),
    chapterSkillFixture({ chapterId: lawChapter.id, skillId: principles.id }),
    planItemFixture({ kind: "mock", planId: plan.id, position: 4 }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  return {
    goal,
    lawChapter,
    portugueseChapter,
    skills: { cohesion, orthography, principles },
    user,
  };
}

function oneLessonSkill(skill: { id: string; name: string }, area: string) {
  return { area, lessons: 1, name: skill.name, phase: 0, skillId: skill.id };
}

async function readTopicStatus(name: string) {
  const result = await getSyllabusView();
  const syllabus = result.status === "ready" ? result.syllabus : null;

  return syllabus?.subjects
    .flatMap((subject) => subject.topics)
    .find((topic) => topic.name === name)?.status;
}

describe(getSyllabusView, () => {
  it("requires a session and the learner's own goal with a plan", async () => {
    const { goal } = await signedInExamLearner({ topics: false });

    mockSession(null);
    await expect(getSyllabusView()).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getSyllabusView()).resolves.toStrictEqual({ status: "noGoal" });

    const withoutPlan = await goalFixture({ userId: other.id });

    await expect(getSyllabusView({ goalId: withoutPlan.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("lists the notice's subjects and topics in its words, matched to the plan's areas", async () => {
    const { goal, lawChapter, portugueseChapter } = await signedInExamLearner({ topics: false });
    const result = await getSyllabusView();
    const syllabus = result.status === "ready" ? result.syllabus : null;

    expect(syllabus).toMatchObject({
      goal: { id: goal.id, kind: "exam", title: "Câmara" },
      kind: "notice",
      noticeUrl: "https://example.com/edital.pdf",
      topicCount: 3,
      topicsMapped: false,
    });

    expect(
      syllabus?.subjects.map((subject) => [
        subject.name,
        subject.group,
        subject.shortName,
        subject.imageUrl,
        subject.share,
        subject.lessonsDone,
        subject.lessonsTotal,
      ]),
    ).toStrictEqual([
      [
        "Língua Portuguesa",
        "Conhecimentos básicos (P1)",
        "Língua Portuguesa",
        "https://example.com/pt.webp",
        0.75,
        1,
        2,
      ],
      [
        "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados",
        "Conhecimentos específicos (P2)",
        "Direito Constitucional",
        "https://example.com/dc.webp",
        0.25,
        0,
        2,
      ],
    ]);

    expect(syllabus?.subjects[0]?.topics.map((topic) => [topic.name, topic.status])).toStrictEqual([
      ["Ortografia", null],
      ["Coesão textual", null],
    ]);

    expect(syllabus?.subjects[0]?.chapters).toStrictEqual([
      {
        chapterId: portugueseChapter.id,
        far: false,
        known: false,
        lessonsDone: 1,
        lessonsTotal: 2,
        nextDate: "2026-10-07",
        plannedLessons: null,
        position: 1,
        skillId: null,
        state: "upcoming",
        title: "Grafia e coesão",
        writing: false,
      },
    ]);

    expect(syllabus?.subjects[1]?.chapters).toMatchObject([
      { chapterId: lawChapter.id, nextDate: "2026-10-06", state: "current" },
    ]);
  });

  it("shows a class test's material by its headings, as the learner's material, not a notice", async () => {
    const user = await userFixture();
    const headings = ["Enzymes", "Glycolysis", "Krebs cycle"];

    const [material, ...skills] = await Promise.all([
      examBlueprintFixture({
        ownerId: user.id,
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: headings.map((name) => ({
            citation,
            name,
            questions: null,
            topics: [],
            weight: null,
          })),
        },
        visibility: "private",
      }),
      ...headings.map((name) => skillFixture({ name: `Explain ${name}` })),
    ]);

    const goal = await goalFixture({
      examBlueprintId: material.id,
      kind: "exam",
      title: "Biochemistry test",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Biochemistry" }],
        skills: skills.map((skill, index) => ({
          area: headings[index],
          lessons: 2,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
        })),
      },
    });

    mockSession(user.id);

    const result = await getSyllabusView({ goalId: goal.id });
    const syllabus = result.status === "ready" ? result.syllabus : null;

    expect(syllabus).toMatchObject({ fromMaterial: true, kind: "notice", topicCount: 0 });
    expect(syllabus?.subjects.map((subject) => subject.name)).toStrictEqual(headings);
  });

  it("ticks each topic once the plan's skills say which topics they teach", async () => {
    await signedInExamLearner({ topics: true });
    const result = await getSyllabusView();
    const syllabus = result.status === "ready" ? result.syllabus : null;

    expect(syllabus?.topicsMapped).toBe(true);
    expect(syllabus?.subjects.map((subject) => subject.topicsStudied)).toStrictEqual([1, 0]);

    expect(
      syllabus?.subjects.flatMap((subject) =>
        subject.topics.map((topic) => [topic.name, topic.status, topic.nextDate]),
      ),
    ).toStrictEqual([
      ["Ortografia", "studied", null],
      ["Coesão textual", "toStudy", "2026-10-07"],
      ["Princípios fundamentais", "toStudy", "2026-10-06"],
    ]);
  });

  it("counts a tested-out lesson for every skill its chapter teaches, so none reads as left out", async () => {
    const user = await userFixture();

    const [membrane, osmosis, chapter, lesson] = await Promise.all([
      skillFixture({ name: "Explicar a membrana" }),
      skillFixture({ name: "Responder sobre osmose" }),
      libraryChapterFixture({ title: "Membrana e osmose" }),
      libraryLessonFixture({ title: "Osmose em questões dissertativas" }),
    ]);

    const goal = await goalFixture({ kind: "learn", title: "Célula", userId: user.id });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Célula" }],
        skills: [membrane, osmosis].map((skill) => ({
          area: skill.name,
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
        })),
      },
    });

    await Promise.all([
      chapterSkillFixture({ chapterId: chapter.id, skillId: membrane.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: osmosis.id }),
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position: 0,
        skillId: osmosis.id,
        status: "testedOut",
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    const result = await getSyllabusView({ goalId: goal.id });
    const subjects = result.status === "ready" ? result.syllabus.subjects : [];

    expect(
      subjects.map((subject) => [
        subject.name,
        subject.notPlannedReason,
        subject.lessonsDone,
        subject.lessonsKnown,
      ]),
    ).toStrictEqual([
      ["Explicar a membrana", null, 0, 1],
      ["Responder sobre osmose", null, 0, 1],
    ]);
  });

  it("tags topics past exams asked a lot, with their source, under the notice's headings", async () => {
    const { goal } = await signedInExamLearner({ topics: false });
    const source = { title: "Os assuntos que mais caem", url: "https://example.com/ranking" };

    await prisma.examBlueprint.update({
      data: {
        structure: {
          ...noticeStructure(),
          pastTopicFrequency: {
            checkedAt: "2026-10-07T10:00:00.000Z",
            subjects: [
              {
                basis: "questões de 2015 a 2025",
                name: "Língua Portuguesa",
                source,
                topics: [{ appearances: null, level: "high", topic: "Coesão textual" }],
              },
            ],
          },
          subjects: noticeStructure().subjects.map((subject, index) =>
            index === 0
              ? {
                  ...subject,
                  topicGroups: [
                    { name: "Gramática", topics: ["Ortografia"] },
                    { name: "Texto", topics: ["Coesão textual"] },
                  ],
                }
              : subject,
          ),
        },
        topicFrequency: [
          {
            appearances: 4,
            basis: "4 de 10 questões da prova de 2025",
            citation,
            level: "medium",
            subject: "Língua Portuguesa",
            topic: "Ortografia",
          },
        ],
      },
      where: { id: goal.examBlueprintId ?? "" },
    });

    const result = await getSyllabusView();
    const subjects = result.status === "ready" ? result.syllabus.subjects : [];

    expect(
      subjects.map((subject) =>
        subject.topics.map(({ frequency, heading, name }) => [name, frequency, heading]),
      ),
    ).toStrictEqual([
      [
        ["Ortografia", "medium", "Gramática"],
        ["Coesão textual", "high", "Texto"],
      ],
      [["Princípios fundamentais", null, null]],
    ]);

    expect(subjects[0]?.topicFrequencySource).toStrictEqual({
      basis: "questões de 2015 a 2025",
      ...source,
    });
  });

  it("says a topic is known only from three right true-or-false answers of its own", async () => {
    const { goal, lawChapter, user } = await signedInExamLearner({ topics: true });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const skillId =
      parsePlanGraph(plan.graph).skills.find((entry) => entry.name === "Aplicar os princípios")
        ?.skillId ?? "";

    await prisma.planItem.deleteMany({ where: { chapterId: lawChapter.id, planId: plan.id } });

    const answerRight = async () => {
      const item = await itemFixture({ format: "trueFalse", skillId });
      await attemptFixture({ isPlacement: true, itemId: item.id, skillId, userId: user.id });
    };

    await answerRight();
    await answerRight();
    await expect(readTopicStatus("Princípios fundamentais")).resolves.toBe("notPlanned");

    await answerRight();
    await expect(readTopicStatus("Princípios fundamentais")).resolves.toBe("known");
  });

  it("gives Today's goal the subjects and lessons the Plan lists for the active goal", async () => {
    const { goal } = await signedInExamLearner({ topics: true });

    const [plan, today] = await Promise.all([
      getSyllabusView(),
      getSyllabusView({ goalId: goal.id }),
    ]);

    expect(today).toStrictEqual(plan);

    const subjects = today.status === "ready" ? today.syllabus.subjects : [];

    expect(
      subjects.map((subject) => [
        subject.shortName,
        subject.lessonsDone,
        subject.lessonsKnown,
        subject.lessonsTotal,
        subject.notPlannedReason,
      ]),
    ).toStrictEqual([
      ["Língua Portuguesa", 1, 0, 2, null],
      ["Direito Constitucional", 0, 0, 2, null],
    ]);
  });

  it("gives each exam subject its preparation on the goal's scale, which adds up to the goal's", async () => {
    const { goal, skills, user } = await signedInExamLearner({ topics: false });
    const { orthography } = skills;

    const items = await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: orthography.id }),
      ),
    );

    await Promise.all([
      attemptFixture({ skillId: orthography.id, userId: user.id }),
      ...items.map((item, index) =>
        attemptFixture({
          isCorrect: index > 0,
          itemId: item.id,
          skillId: orthography.id,
          userId: user.id,
        }),
      ),
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: new Date(),
        recallDays: 1,
        reps: 2,
        skillId: orthography.id,
        stability: 10,
        state: "learning",
        userId: user.id,
      }),
    ]);

    const [result, goalPreparation] = await Promise.all([
      getSyllabusView(),
      getGoalPreparation(goal.id),
    ]);

    const subjects = result.status === "ready" ? result.syllabus.subjects : [];
    const preparation = goalPreparation.status === "ready" ? goalPreparation.preparation : null;
    const [portuguese, law] = subjects;

    expect(portuguese?.preparation).toBeGreaterThan(0);
    expect(law?.preparation).toBe(0);
    expect(portuguese?.preparation).toBeGreaterThan(preparation?.value ?? 1);

    expect(
      preparation?.sections.reduce((sum, section) => sum + section.preparation * section.weight, 0),
    ).toBeCloseTo(preparation?.value ?? -1, 6);

    expect(preparation?.sections.map((section) => section.section).toSorted()).toStrictEqual([
      "Direito Constitucional",
      "Língua Portuguesa",
    ]);
  });

  it("keeps the goal's preparation within its subjects' when each has only a few answers", async ({
    onTestFinished,
  }) => {
    // Both independent reads compare the same instant; recall decays between real clock samples.
    vi.useFakeTimers({ toFake: ["Date"] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const { goal, skills, user } = await signedInExamLearner({ topics: false });
    const studied = [skills.orthography, skills.cohesion, skills.principles];
    const answered = [skills.orthography, skills.principles];

    const items = await Promise.all(
      answered.flatMap((skill) =>
        Array.from({ length: 3 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        ),
      ),
    );

    await Promise.all([
      ...studied.flatMap((skill) => [
        attemptFixture({ skillId: skill.id, userId: user.id }),
        learnerSkillFixture({
          difficulty: 5,
          lastReviewedAt: new Date(),
          recallDays: 1,
          reps: 2,
          skillId: skill.id,
          stability: 10,
          state: "learning",
          userId: user.id,
        }),
      ]),
      ...items.map((item) =>
        attemptFixture({ itemId: item.id, skillId: item.skillId, userId: user.id }),
      ),
    ]);

    const [result, goalPreparation] = await Promise.all([
      getSyllabusView(),
      getGoalPreparation(goal.id),
    ]);

    const subjects = result.status === "ready" ? result.syllabus.subjects : [];
    const preparation = goalPreparation.status === "ready" ? goalPreparation.preparation : null;
    const shares = subjects.map((subject) => subject.preparation ?? -1);

    expect(shares).toHaveLength(2);
    expect(Math.min(...shares)).toBeGreaterThan(0);
    expect(preparation?.value).toBeGreaterThanOrEqual(Math.min(...shares) - 1e-9);
    expect(preparation?.value).toBeLessThanOrEqual(Math.max(...shares) + 1e-9);

    expect(subjects.map((subject) => subject.mastery)).toStrictEqual([null, null]);
    expect(preparation?.components.mastery.value).toBeNull();

    const more = await Promise.all(
      Array.from({ length: 2 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skills.orthography.id }),
      ),
    );

    await Promise.all(
      more.map((item) =>
        attemptFixture({ itemId: item.id, skillId: item.skillId, userId: user.id }),
      ),
    );

    const [after, goalAfter] = await Promise.all([getSyllabusView(), getGoalPreparation(goal.id)]);
    const subjectsAfter = after.status === "ready" ? after.syllabus.subjects : [];
    const valueAfter = goalAfter.status === "ready" ? goalAfter.preparation : null;
    const sharesAfter = subjectsAfter.map((subject) => subject.preparation ?? -1);

    expect(subjectsAfter.map((subject) => subject.mastery)).toStrictEqual([
      { answered: 5, correct: 5 },
      null,
    ]);

    expect(valueAfter?.components.mastery).toMatchObject({ answered: 5, correct: 5 });
    expect(sharesAfter[0]).toBeGreaterThan(shares[0] ?? 1);
    expect(valueAfter?.value).toBeGreaterThanOrEqual(Math.min(...sharesAfter) - 1e-9);
    expect(valueAfter?.value).toBeLessThanOrEqual(Math.max(...sharesAfter) + 1e-9);
  });

  it("gives a subject the plan left out its preparation while the goal counts it", async () => {
    const { goal, lawChapter, skills, user } = await signedInExamLearner({ topics: false });
    const { orthography } = skills;

    const items = await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: orthography.id }),
      ),
    );

    await Promise.all([
      attemptFixture({ skillId: orthography.id, userId: user.id }),
      ...items.map((item) =>
        attemptFixture({ itemId: item.id, skillId: orthography.id, userId: user.id }),
      ),
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: new Date(),
        recallDays: 1,
        reps: 2,
        skillId: orthography.id,
        stability: 10,
        state: "learning",
        userId: user.id,
      }),
      prisma.planItem.deleteMany({
        where: { chapterId: lawChapter.id, plan: { goalId: goal.id } },
      }),
    ]);

    const read = async () => {
      const [result, goalPreparation] = await Promise.all([
        getSyllabusView(),
        getGoalPreparation(goal.id),
      ]);

      return {
        subjects: result.status === "ready" ? result.syllabus.subjects : [],
        value: goalPreparation.status === "ready" ? goalPreparation.preparation.value : null,
      };
    };

    const { subjects, value } = await read();
    const [portuguese, law] = subjects;

    expect(law?.notPlannedReason).toBe("time");
    expect(law?.preparation).toBe(0);
    expect(law?.mastery).toBeNull();
    expect(portuguese?.preparation).toBeGreaterThan(value ?? 1);
    expect(value).toBeGreaterThanOrEqual(law?.preparation ?? 1);

    await prisma.plan.update({
      data: { settings: { skippedAreas: ["Direito Constitucional"] } },
      where: { goalId: goal.id },
    });

    const skipped = await read();

    expect(skipped.subjects[1]?.notPlannedReason).toBe("skipped");
    expect(skipped.subjects[1]?.preparation).toBeNull();
    expect(skipped.value).toBeCloseTo(skipped.subjects[0]?.preparation ?? -1, 6);
  });

  it("measures a goal that isn't an exam in lessons: its modules' bars added up, finished at 100%", async () => {
    const user = await userFixture();

    const [first, second, third] = await Promise.all([
      skillFixture({ name: "Ler um gráfico de preços" }),
      skillFixture({ name: "Entender dividendos" }),
      skillFixture({ name: "Montar uma carteira" }),
    ]);

    const goal = await goalFixture({ kind: "learn", title: "Bolsa de valores", userId: user.id });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Fundamentos" }],
        skills: [
          oneLessonSkill(first, "Como a bolsa funciona"),
          oneLessonSkill(second, "Como a bolsa funciona"),
          oneLessonSkill(third, "Investir"),
        ],
      },
    });

    const [ahead] = await Promise.all([
      planItemFixture({ planId: plan.id, position: 2, skillId: third.id }),
      planItemFixture({ planId: plan.id, position: 0, skillId: first.id, status: "done" }),
      planItemFixture({ planId: plan.id, position: 1, skillId: second.id, status: "testedOut" }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    const midway = await getSyllabusView();
    const syllabus = midway.status === "ready" ? midway.syllabus : null;

    expect(syllabus?.subjects.map((subject) => subject.preparation)).toStrictEqual([null, null]);
    expect(syllabus?.lessons).toStrictEqual({ done: 2, known: 1, total: 3 });

    await prisma.planItem.update({ data: { status: "done" }, where: { id: ahead.id } });

    const finished = await getSyllabusView();

    expect(finished.status === "ready" && finished.syllabus.lessons).toStrictEqual({
      done: 3,
      known: 1,
      total: 3,
    });
  });
});
