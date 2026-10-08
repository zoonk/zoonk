import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSyllabusView } from "./get-syllabus-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

/** A notice with two subjects in two groups, as a Câmara notice lists them. */
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

/**
 * An exam learner whose plan teaches Portuguese (orthography done, cohesion ahead) and
 * constitutional law in two chapters, from courses with icons. `topics` maps skills to the
 * notice's topics, as graphs written from the notice do.
 */
async function signedInExamLearner({ topics }: { topics: boolean }) {
  const user = await userFixture();

  const [blueprint, portugueseCourse, lawCourse, orthography, cohesion, principles, lesson] =
    await Promise.all([
      examBlueprintFixture({
        edition: {
          citations: [],
          dates: [],
          noticeUrl: "https://example.com/edital.pdf",
          questionCount: null,
          sourceHash: null,
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
    // A lesson saved without its skill still counts for the subject its lesson teaches.
    planItemFixture({
      chapterId: portugueseChapter.id,
      lessonId: lesson.id,
      planId: plan.id,
      position: 2,
      scheduledFor: new Date("2026-10-07T00:00:00.000Z"),
    }),
    // So does a whole chapter planned as one item: it teaches its chapter's skills.
    planItemFixture({ chapterId: lawChapter.id, kind: "chapter", planId: plan.id, position: 3 }),
    chapterSkillFixture({ chapterId: lawChapter.id, skillId: principles.id }),
    planItemFixture({ kind: "mock", planId: plan.id, position: 4 }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  return { goal, lawChapter, portugueseChapter, user };
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
        lessonsDone: 1,
        lessonsTotal: 2,
        nextDate: "2026-10-07",
        position: 1,
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

    // The chapter teaches both skills; its one planned lesson counts for the second, and placement
    // tested it out.
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
      subjects.map((subject) => [subject.name, subject.notPlannedReason, subject.lessonsDone]),
    ).toStrictEqual([
      ["Explicar a membrana", null, 1],
      ["Responder sobre osmose", null, 1],
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
});
