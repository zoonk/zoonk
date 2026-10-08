import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { mockDecision, mockSearchTerms, uniqueWord } from "../identity/_test-utils/identity-mocks";
import { findUntaughtSkills } from "./course-outline-state";
import { type OutlineChapter, saveOutlineChapter } from "./save-outline-chapter";

/** Model calls are the external boundary; identity search, claims and storage run for real. */
vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

const provenance = {
  generatedAt: new Date(),
  model: "openai/gpt-6-sol",
  promptVersion: "v1",
  runId: "run",
};

const scope = {
  generalGoal: "Passar em um concurso",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

function outlineChapter({
  lessons,
  title,
}: {
  lessons: { skills: string[]; title: string }[];
  title: string;
}): OutlineChapter {
  const outlined = lessons.map((lesson) => ({
    canDo: `Fazer ${lesson.title}`,
    description: `Por que ${lesson.title} importa`,
    estimatedMinutes: 3,
    skills: lesson.skills,
    title: lesson.title,
  }));

  return {
    description: `O que ${title} cobre`,
    lessons: outlined,
    objectives: ["Identificar o tema de textos curtos"],
    skillKeys: [],
    title,
    tools: [],
  };
}

function outlineIn({
  chapter,
  courseId,
  position = 0,
}: {
  chapter: OutlineChapter;
  courseId: string;
  position?: number;
}) {
  return saveOutlineChapter({
    chapter,
    courseId,
    goalSkills: [],
    level: "beginner",
    position,
    provenance,
    scope,
    workflowRunId: randomUUID(),
  });
}

/** Two courses on different subjects, as ENEM's foreign-language reading and Portuguese are. */
async function twoSubjects(word: string) {
  return Promise.all([
    courseFixture({ language: "pt", title: `Leitura em língua estrangeira ${word}` }),
    courseFixture({ language: "pt", title: `Língua Portuguesa ${word}` }),
  ]);
}

function decisionCalls(kind: "chapter" | "lesson") {
  return vi
    .mocked(decideLibraryIdentity)
    .mock.calls.map(([input]) => input)
    .filter((input) => input.subject.kind === kind);
}

describe("reuse across courses", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDecision(null);
  });

  it("never reuses another subject's chapter by its title, and shows the decision both courses", async () => {
    const word = uniqueWord();
    const [foreign, portuguese] = await twoSubjects(word);
    mockSearchTerms([word]);

    const chapter = outlineChapter({
      lessons: [
        { skills: [`Identificar o tema ${word}`], title: `Pistas antes da leitura ${word}` },
      ],
      title: `Tema e informações explícitas ${word}`,
    });

    const english = await outlineIn({ chapter, courseId: foreign.id });
    const ownChapter = await outlineIn({ chapter, courseId: portuguese.id });

    expect(ownChapter.chapterId).not.toBe(english.chapterId);
    expect(ownChapter.lessonIds.some((id) => english.lessonIds.includes(id))).toBe(false);

    const asked = decisionCalls("chapter").find((input) =>
      input.candidates.some((candidate) => candidate.id === english.chapterId),
    );

    expect(asked?.subject.item.courses).toStrictEqual([portuguese.title]);

    expect(
      asked?.candidates.find((candidate) => candidate.id === english.chapterId)?.item.courses,
    ).toStrictEqual([foreign.title]);
  });

  it("never reuses another subject's lesson because it teaches the same shared skills", async () => {
    const word = uniqueWord();
    const [foreign, portuguese] = await twoSubjects(word);
    mockSearchTerms([word]);
    const skills = [`Identificar causa e consequência ${word}`];

    const english = await outlineIn({
      chapter: outlineChapter({
        lessons: [{ skills, title: `Causa e consequência ${word}` }],
        title: `Ligações entre ideias ${word}`,
      }),
      courseId: foreign.id,
    });

    const own = await outlineIn({
      chapter: outlineChapter({
        lessons: [{ skills, title: `Causa e consequência ${word}` }],
        title: `Conectivos e sentido ${uniqueWord()}`,
      }),
      courseId: portuguese.id,
    });

    const [englishLesson, ownLesson] = await Promise.all(
      [english, own].map((saved) =>
        prisma.lesson.findUniqueOrThrow({
          include: { skills: true },
          omit: { spec: true, summary: true },
          where: { id: saved.lessonIds[0] },
        }),
      ),
    );

    // Skills are shared by design; the lesson that teaches them in another subject is not.
    expect(ownLesson?.skills.map((row) => row.skillId)).toStrictEqual(
      englishLesson?.skills.map((row) => row.skillId),
    );

    expect(ownLesson?.id).not.toBe(englishLesson?.id);

    const asked = decisionCalls("lesson").find((input) =>
      input.candidates.some((candidate) => candidate.id === englishLesson?.id),
    );

    expect(asked?.subject.item.courses).toStrictEqual([portuguese.title]);
  });

  it("asks no reuse decision for a lesson whose skills are all new to the Library", async () => {
    const word = uniqueWord();
    const [foreign, portuguese] = await twoSubjects(word);
    mockSearchTerms([word]);

    await outlineIn({
      chapter: outlineChapter({
        lessons: [{ skills: [`Identificar o tema ${word}`], title: `Tema do texto ${word}` }],
        title: `Leitura atenta ${word}`,
      }),
      courseId: foreign.id,
    });

    vi.mocked(decideLibraryIdentity).mockClear();

    // Its one skill is created now, so no lesson in the Library can teach it yet, although the
    // search would find the other course's lesson by its words.
    const own = await outlineIn({
      chapter: outlineChapter({
        lessons: [
          { skills: [`Resumir um parágrafo ${uniqueWord()}`], title: `Tema do texto ${word}` },
        ],
        title: `Resumos ${uniqueWord()}`,
      }),
      courseId: portuguese.id,
    });

    expect(own.lessonIds.length).toBeGreaterThan(0);
    expect(decisionCalls("lesson")).toStrictEqual([]);
  });

  it("still reuses a chapter and a lesson exactly inside the same course", async () => {
    const word = uniqueWord();
    const [, portuguese] = await twoSubjects(word);
    mockSearchTerms([uniqueWord()]);
    const skills = [`Distinguir causa de consequência ${word}`];

    const chapter = outlineChapter({
      lessons: [{ skills, title: `Causa e consequência ${word}` }],
      title: `Ligações de sentido ${word}`,
    });

    const first = await outlineIn({ chapter, courseId: portuguese.id });
    const again = await outlineIn({ chapter, courseId: portuguese.id });

    const other = await outlineIn({
      chapter: outlineChapter({
        lessons: [{ skills, title: `Motivo e resultado ${word}` }],
        title: `Leitura atenta ${word}`,
      }),
      courseId: portuguese.id,
      position: 1,
    });

    expect(again).toStrictEqual(first);
    expect(other.lessonIds[0]).toBe(first.lessonIds[0]);
    expect(decisionCalls("lesson")).toStrictEqual([]);
  });
});

describe("taught skills per course", () => {
  it("counts a skill as taught only by lessons and tagged chapters of the course being outlined", async () => {
    const [foreign, portuguese, byLesson, byChapter] = await Promise.all([
      courseFixture(),
      courseFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const [chapter, lesson] = await Promise.all([libraryChapterFixture(), libraryLessonFixture()]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: foreign.id, position: 0 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: byLesson.id }),
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: byChapter.id } }),
    ]);

    const skillIds = [byLesson.id, byChapter.id];

    await expect(
      findUntaughtSkills({ courseId: portuguese.id, ownerId: null, skillIds }),
    ).resolves.toStrictEqual(skillIds);

    await expect(
      findUntaughtSkills({ courseId: foreign.id, ownerId: null, skillIds }),
    ).resolves.toStrictEqual([]);
  });
});

describe("planning a skill from its own course", () => {
  it("plans only the lessons the skill's course places, never another subject's", async () => {
    const user = await userFixture();

    const [goal, skill, foreign, portuguese] = await Promise.all([
      goalFixture({ userId: user.id }),
      skillFixture(),
      courseFixture(),
      courseFixture(),
    ]);

    const [foreignChapter, ownChapter, foreignLesson, ownLesson, taggedLesson] = await Promise.all([
      libraryChapterFixture(),
      libraryChapterFixture(),
      libraryLessonFixture({ title: "Reading a bus timetable" }),
      libraryLessonFixture({ title: "Causa e consequência" }),
      libraryLessonFixture({ title: "Missing poster" }),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: foreignChapter.id, courseId: foreign.id, position: 0 }),
      courseChapterFixture({ chapterId: ownChapter.id, courseId: portuguese.id, position: 0 }),
      chapterLessonFixture({
        chapterId: foreignChapter.id,
        lessonId: foreignLesson.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: foreignChapter.id,
        lessonId: taggedLesson.id,
        position: 1,
      }),
      chapterLessonFixture({ chapterId: ownChapter.id, lessonId: ownLesson.id, position: 0 }),
      lessonSkillFixture({ lessonId: foreignLesson.id, skillId: skill.id }),
      lessonSkillFixture({ lessonId: ownLesson.id, skillId: skill.id }),
      prisma.chapterSkill.create({ data: { chapterId: foreignChapter.id, skillId: skill.id } }),
      prisma.plan.create({
        data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
      }),
    ]);

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Fundamentos" }],
        skills: [
          {
            area: "Língua Portuguesa",
            courseIds: [portuguese.id],
            lessons: 2,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", plan: { goalId: goal.id } },
    });

    expect(items.map((item) => [item.lessonId, item.chapterId])).toStrictEqual([
      [ownLesson.id, ownChapter.id],
    ]);
  });
});
