import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag, getCourseRouteCacheTag } from "../../cache/tags";
import { createGoalPlan } from "../../plans/create-goal-plan";
import {
  getCandidateIds,
  mockDecision,
  mockSearchTerms,
  mockSearchTermsFor,
  uniqueWord,
} from "../identity/_test-utils/identity-mocks";
import {
  claimCourseOutline,
  findUntaughtSkills,
  finishCourseOutline,
  getCourseBandContext,
} from "./course-outline-state";
import { findOrCreateGoalCourse } from "./find-or-create-goal-course";
import { replanGoalsWaitingOnSkills } from "./replan-waiting-goals";
import { saveGoalSkills } from "./save-goal-skills";
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

const scope = { generalGoal: "Learn physics", language: "en", ownerId: null, targetLanguage: null };

function outlineChapter(overrides: Partial<OutlineChapter> & { title: string }): OutlineChapter {
  return {
    description: `What ${overrides.title} covers`,
    lessons: [],
    objectives: ["Explain the idea"],
    skillKeys: [],
    tools: [],
    ...overrides,
  };
}

function outlineLesson(title: string, skills: string[]) {
  return {
    canDo: `Do ${title}`,
    description: `Why ${title} matters`,
    estimatedMinutes: 3,
    skills,
    title,
  };
}

/** Each search-terms call's subjects, as "kind:title", in the order the calls were made. */
function searchTermsCalls(): string[][] {
  return vi
    .mocked(generateSearchTerms)
    .mock.calls.map(([input]) =>
      input.subjects.map((subject) => `${subject.kind}:${subject.item.title}`),
    );
}

/** Reuses the first candidate that is one of `ids`, as the reuse decision would when it agrees. */
function mockReuseOf(ids: readonly string[]) {
  vi.mocked(decideLibraryIdentity).mockImplementation(({ candidates }) => {
    const reused = candidates.find((candidate) => ids.includes(candidate.id));

    return Promise.resolve({
      match: reused ? { id: reused.id, model: "test/jev", probability: 0.9 } : null,
      verdicts: [],
    });
  });
}

describe(saveGoalSkills, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("creates each graph skill once and finds the same skills again for a later goal", async () => {
    const word = uniqueWord();

    const skills = [
      {
        course: "math",
        description: "Move terms across an equation",
        estimatedLessons: 3,
        examWeight: null,
        key: "isolate",
        level: "beginner" as const,
        name: `Isolate a variable ${word}`,
        phase: 1,
        prerequisites: [],
      },
    ];

    const first = await saveGoalSkills({ provenance, scope, skills });
    const second = await saveGoalSkills({ provenance, scope, skills });

    expect(second).toStrictEqual(first);

    await expect(
      prisma.skill.findUniqueOrThrow({ where: { id: first.isolate } }),
    ).resolves.toMatchObject({
      level: "beginner",
      model: "openai/gpt-6-sol",
      name: `Isolate a variable ${word}`,
      visibility: "public",
    });
  });

  it("writes a slice's search terms in one call and gives two slices saving a skill at once one row", async () => {
    const word = uniqueWord();

    const skills = ["Isolate a variable", "Graph a line", "Solve a system"].map((name, index) => ({
      course: "math",
      description: `${name} step by step`,
      estimatedLessons: 2,
      examWeight: null,
      key: `skill-${index}`,
      level: "beginner" as const,
      name: `${name} ${word}`,
      phase: 1,
      prerequisites: [],
    }));

    const [first, second] = await Promise.all([
      saveGoalSkills({ provenance, scope, skills }),
      saveGoalSkills({ provenance, scope, skills }),
    ]);

    expect(second).toStrictEqual(first);

    expect(searchTermsCalls()).toStrictEqual([
      skills.map((skill) => `skill:${skill.name}`),
      skills.map((skill) => `skill:${skill.name}`),
    ]);

    await expect(
      prisma.skill.count({ where: { name: { in: skills.map((skill) => skill.name) } } }),
    ).resolves.toBe(skills.length);
  });
});

describe(findOrCreateGoalCourse, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("reuses a shared course named differently for the same subject once the reuse decision agrees", async () => {
    const word = uniqueWord();
    const organization = await aiOrganizationFixture();

    const [existing] = await Promise.all([
      courseFixture({
        description: `Forces and motion ${word}`,
        organizationId: organization.id,
        title: "Newtonian mechanics",
      }),
      courseFixture({
        description: `Forces and motion ${word}`,
        language: "pt",
        organizationId: organization.id,
      }),
      courseFixture({ description: `Forces and motion ${word}`, title: "Someone's own mechanics" }),
    ]);

    mockSearchTerms([word]);
    const decision = mockDecision(existing.id);

    const result = await findOrCreateGoalCourse({
      format: "core",
      provenance,
      scope,
      title: `Classical mechanics ${uniqueWord()}`,
    });

    expect(result).toStrictEqual({ course: existing, created: false });
    // Only the AI organization's shared courses in the same language are candidates.
    expect(getCandidateIds(decision)).toStrictEqual([existing.id]);
  });

  it("creates the course when no shared course is the same subject", async () => {
    const word = uniqueWord();
    const organization = await aiOrganizationFixture();

    await courseFixture({
      description: `Mechanics, optics and more ${word}`,
      organizationId: organization.id,
      title: "Physics",
    });

    mockSearchTerms([word]);
    const decision = mockDecision(null);
    const title = `Classical mechanics ${uniqueWord()}`;

    const result = await findOrCreateGoalCourse({ format: "core", provenance, scope, title });

    expect(decision).toHaveBeenCalledOnce();
    expect(result.created).toBe(true);

    // A new course keeps the provenance of the run that named it.
    expect(result.course).toMatchObject({
      generatedAt: provenance.generatedAt,
      model: provenance.model,
      organizationId: organization.id,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
      title,
    });
  });

  it("gives two goals naming the same shared course at once one row", async () => {
    const title = `Mechanics ${uniqueWord()}`;

    const [first, second] = await Promise.all([
      findOrCreateGoalCourse({ format: "core", provenance, scope, title }),
      findOrCreateGoalCourse({ format: "core", provenance, scope, title }),
    ]);

    expect(first.course.id).toBe(second.course.id);

    expect([first.created, second.created].toSorted((a, b) => Number(a) - Number(b))).toStrictEqual(
      [false, true],
    );

    expect(first.course).toMatchObject({
      isPublished: false,
      outlineStatus: "pending",
      visibility: "public",
    });
  });

  it("keeps a private course apart from a shared one with the same title", async () => {
    const [user, title] = await Promise.all([
      userFixture(),
      Promise.resolve(`Mechanics ${uniqueWord()}`),
    ]);

    const [shared, owned] = await Promise.all([
      findOrCreateGoalCourse({ format: "core", provenance, scope, title }),
      findOrCreateGoalCourse({
        format: "personalized",
        provenance,
        scope: { ...scope, ownerId: user.id },
        title,
      }),
    ]);

    expect(owned.course.id).not.toBe(shared.course.id);

    expect(owned.course).toMatchObject({
      organizationId: null,
      userId: user.id,
      visibility: "private",
    });
  });
});

describe(saveOutlineChapter, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("writes the chapter, its place, the goal skills it teaches, its tools and every lesson with its skills", async () => {
    const [course, goalSkill] = await Promise.all([
      courseFixture({ outlineStatus: "running" }),
      skillFixture(),
    ]);

    const word = uniqueWord();

    const chapter = outlineChapter({
      lessons: [
        outlineLesson(`Newton's first law ${word}`, [`Explain inertia ${word}`]),
        outlineLesson(`Net force ${word}`, [goalSkill.name, `Add force vectors ${word}`]),
      ],
      skillKeys: ["forces"],
      title: `Forces ${word}`,
      tools: [{ essential: false, name: "Python" }],
    });

    const context = {
      chapter,
      courseId: course.id,
      goalSkills: [
        {
          description: goalSkill.description,
          id: goalSkill.id,
          key: "forces",
          name: goalSkill.name,
        },
      ],
      level: "beginner" as const,
      position: 0,
      provenance,
      scope,
      workflowRunId: randomUUID(),
    };

    const saved = await saveOutlineChapter(context);
    const again = await saveOutlineChapter(context);

    expect(again).toStrictEqual(saved);

    const [placement, tags, lessons] = await Promise.all([
      prisma.courseChapter.findMany({ where: { courseId: course.id } }),
      prisma.chapterSkill.findMany({ where: { chapterId: saved.chapterId } }),
      prisma.lesson.findMany({
        include: { skills: { include: { skill: true }, orderBy: { createdAt: "asc" } } },
        omit: { spec: true, summary: true },
        where: { id: { in: saved.lessonIds } },
      }),
    ]);

    expect(placement).toMatchObject([
      { chapterId: saved.chapterId, level: "beginner", position: 0 },
    ]);

    expect(tags.map((tag) => tag.skillId)).toStrictEqual([goalSkill.id]);
    // The outline's two lessons, then the chapter's challenge on their skills.
    expect(saved.lessonIds).toHaveLength(3);

    expect(lessons.find((lesson) => lesson.id === saved.lessonIds[2])).toMatchObject({
      specStatus: "completed",
      title: `Challenge: Forces ${word}`,
    });

    const netForce = lessons.find((lesson) => lesson.title === `Net force ${word}`);

    expect(netForce).toMatchObject({
      canDo: `Do Net force ${word}`,
      homeChapterId: saved.chapterId,
    });

    expect(netForce?.skills.map((entry) => entry.skillId)).toContain(goalSkill.id);

    await expect(
      prisma.chapter.findUniqueOrThrow({ where: { id: saved.chapterId } }),
    ).resolves.toMatchObject({
      homeCourseId: course.id,
      outlineStatus: "completed",
      tools: [{ essential: false, name: "Python" }],
    });
  });

  it("writes the search terms of the chapter, its skills and its lessons in one call each, and resolves a skill named twice once", async () => {
    const [course, goalSkill] = await Promise.all([
      courseFixture({ outlineStatus: "running" }),
      skillFixture(),
    ]);

    const word = uniqueWord();
    const shared = `Read a force diagram ${word}`;
    const lessonTitles = [`Forces ${word}`, `Balanced forces ${word}`, `Friction ${word}`];

    const saved = await saveOutlineChapter({
      chapter: outlineChapter({
        lessons: [
          outlineLesson(lessonTitles[0] ?? "", [goalSkill.name, shared]),
          outlineLesson(lessonTitles[1] ?? "", [shared, `Add forces ${word}`]),
          outlineLesson(lessonTitles[2] ?? "", [`Explain friction ${word}`]),
        ],
        title: `Dynamics ${word}`,
      }),
      courseId: course.id,
      goalSkills: [
        {
          description: goalSkill.description,
          id: goalSkill.id,
          key: "forces",
          name: goalSkill.name,
        },
      ],
      level: "beginner",
      position: 0,
      provenance,
      scope,
      workflowRunId: randomUUID(),
    });

    // The chapter first; then its skills (the goal's own skill needs no search) beside its lessons.
    const calls = searchTermsCalls();

    expect(calls[0]).toStrictEqual([`chapter:Dynamics ${word}`]);

    expect(calls).toHaveLength(3);

    expect(calls.slice(1)).toStrictEqual(
      expect.arrayContaining([
        lessonTitles.map((title) => `lesson:${title}`),
        [`skill:${shared}`, `skill:Add forces ${word}`, `skill:Explain friction ${word}`],
      ]),
    );

    const [sharedSkills, lessons] = await Promise.all([
      prisma.skill.findMany({ where: { name: shared } }),
      prisma.lesson.findMany({
        include: { skills: true },
        omit: { spec: true, summary: true },
        where: { id: { in: saved.lessonIds } },
      }),
    ]);

    const skillIdsOf = (title: string) =>
      lessons.find((lesson) => lesson.title === title)?.skills.map((entry) => entry.skillId);

    expect(sharedSkills).toHaveLength(1);
    expect(saved.lessonIds).toHaveLength(4);

    expect(skillIdsOf(lessonTitles[0] ?? "")).toStrictEqual(
      expect.arrayContaining([goalSkill.id, sharedSkills[0]?.id]),
    );

    expect(skillIdsOf(lessonTitles[1] ?? "")).toContain(sharedSkills[0]?.id);
  });

  // A real outline gave "Lançamento de ofício", "por declaração" and "por homologação" one skill.
  it("keeps lessons that split one skill set apart, and finds each of them again", async () => {
    const course = await courseFixture({ outlineStatus: "running" });
    const word = uniqueWord();
    const shared = `Classify assessment types ${word}`;
    const titles = [`Ex officio ${word}`, `By declaration ${word}`, `Self-assessment ${word}`];

    const context = {
      chapter: outlineChapter({
        lessons: [
          ...titles.map((title) => outlineLesson(title, [shared])),
          outlineLesson(`Notice of assessment ${word}`, [`Check a tax notice ${word}`]),
        ],
        title: `Assessments ${word}`,
      }),
      courseId: course.id,
      goalSkills: [],
      level: "beginner" as const,
      position: 0,
      provenance,
      scope,
      workflowRunId: randomUUID(),
    };

    const saved = await saveOutlineChapter(context);
    const again = await saveOutlineChapter(context);

    expect(again).toStrictEqual(saved);

    const [lessons, sharedSkills] = await Promise.all([
      prisma.lesson.findMany({
        include: { skills: true },
        omit: { spec: true, summary: true },
        where: { id: { in: saved.lessonIds } },
      }),
      prisma.skill.findMany({ where: { name: shared } }),
    ]);

    const titleOf = (id: string | undefined) => lessons.find((lesson) => lesson.id === id)?.title;

    // The outline's four lessons, in order, then the chapter's challenge.
    expect(saved.lessonIds.slice(0, 4).map((id) => titleOf(id))).toStrictEqual([
      ...titles,
      `Notice of assessment ${word}`,
    ]);

    expect(saved.lessonIds).toHaveLength(5);
    expect(sharedSkills).toHaveLength(1);

    expect(
      lessons
        .filter((lesson) => titles.includes(lesson.title))
        .map((lesson) => lesson.skills.map((entry) => entry.skillId)),
    ).toStrictEqual(titles.map(() => [sharedSkills[0]?.id]));
  });

  it("reuses a skill and a lesson the Library already has when search and the decision find them", async () => {
    const word = uniqueWord();

    const [course, skill, lesson] = await Promise.all([
      courseFixture({ outlineStatus: "running" }),
      skillFixture({ name: `Work out a ${word} gratuity` }),
      libraryLessonFixture({ title: `Tipping ${word}` }),
    ]);

    await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
    mockSearchTermsFor((subject) => (subject.kind === "chapter" ? [] : [word]));
    mockReuseOf([skill.id, lesson.id]);

    const outlined = {
      lesson: `Leave a tip ${uniqueWord()}`,
      skill: `Calculate a tip ${uniqueWord()}`,
    };

    const saved = await saveOutlineChapter({
      chapter: outlineChapter({
        lessons: [outlineLesson(outlined.lesson, [outlined.skill])],
        title: `Eating out ${uniqueWord()}`,
      }),
      courseId: course.id,
      goalSkills: [],
      level: "beginner",
      position: 0,
      provenance,
      scope,
      workflowRunId: randomUUID(),
    });

    expect(saved.lessonIds[0]).toBe(lesson.id);

    await expect(
      Promise.all([
        prisma.skill.count({ where: { name: outlined.skill } }),
        prisma.lesson.count({ where: { title: outlined.lesson } }),
      ]),
    ).resolves.toStrictEqual([0, 0]);
  });

  it("writes no search terms for a private course's chapter", async () => {
    const user = await userFixture();

    const course = await courseFixture({
      outlineStatus: "running",
      userId: user.id,
      visibility: "private",
    });

    const word = uniqueWord();

    const saved = await saveOutlineChapter({
      chapter: outlineChapter({
        lessons: [outlineLesson(`Vectors ${word}`, [`Add vectors ${word}`])],
        title: `Motion ${word}`,
      }),
      courseId: course.id,
      goalSkills: [],
      level: "beginner",
      position: 0,
      provenance,
      scope: { ...scope, ownerId: user.id },
      workflowRunId: randomUUID(),
    });

    expect(saved.lessonIds).toHaveLength(2);
    expect(generateSearchTerms).not.toHaveBeenCalled();
  });

  it("keeps the lessons of a chapter another outline already wrote", async () => {
    const word = uniqueWord();

    const existing = await libraryChapterFixture({
      outlineStatus: "completed",
      title: `Energy ${word}`,
    });

    const [course, lesson] = await Promise.all([courseFixture(), libraryLessonFixture()]);

    await chapterLessonFixture({ chapterId: existing.id, lessonId: lesson.id });
    mockSearchTerms([word]);
    mockDecision(existing.id);

    const saved = await saveOutlineChapter({
      chapter: outlineChapter({
        lessons: [outlineLesson("Something else", ["Other skill"])],
        title: `Energy ${word}`,
      }),
      courseId: course.id,
      goalSkills: [],
      level: "beginner",
      position: 3,
      provenance,
      scope,
      workflowRunId: randomUUID(),
    });

    expect(saved).toStrictEqual({ chapterId: existing.id, lessonIds: [lesson.id] });
  });
});

describe("course outline state", () => {
  it("finds the goal skills no lesson or tagged chapter of the course teaches yet", async () => {
    const [taughtByLesson, taughtByChapter, untaught, chapter, lesson, course] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
      libraryChapterFixture(),
      libraryLessonFixture(),
      courseFixture(),
    ]);

    await Promise.all([
      prisma.lessonSkill.create({ data: { lessonId: lesson.id, skillId: taughtByLesson.id } }),
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: taughtByChapter.id } }),
      prisma.courseChapter.create({
        data: { chapterId: chapter.id, courseId: course.id, level: "beginner", position: 0 },
      }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
    ]);

    await expect(
      findUntaughtSkills({
        courseId: course.id,
        ownerId: null,
        skillIds: [taughtByLesson.id, taughtByChapter.id, untaught.id],
      }),
    ).resolves.toStrictEqual([untaught.id]);
  });

  it("reopens a written outline for a later goal's missing skills and lists the course once written", async () => {
    const course = await courseFixture({ outlineStatus: "pending", visibility: "public" });
    const first = randomUUID();
    const second = randomUUID();

    await expect(claimCourseOutline({ courseId: course.id, workflowRunId: first })).resolves.toBe(
      "claimed",
    );

    await expect(claimCourseOutline({ courseId: course.id, workflowRunId: second })).resolves.toBe(
      "running",
    );

    await finishCourseOutline({ courseId: course.id, status: "completed", workflowRunId: first });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ isPublished: true, outlineStatus: "completed" });

    await expect(claimCourseOutline({ courseId: course.id, workflowRunId: second })).resolves.toBe(
      "claimed",
    );
  });

  it("expires a listed course's page, address and catalog", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      organizationId: organization.id,
      outlineStatus: "pending",
      visibility: "public",
    });

    const runId = randomUUID();

    await claimCourseOutline({ courseId: course.id, workflowRunId: runId });
    await finishCourseOutline({ courseId: course.id, status: "completed", workflowRunId: runId });

    const expired = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag);

    expect(expired).toStrictEqual(
      expect.arrayContaining([
        getCourseCacheTag(course.id),
        COURSE_LIST_CACHE_TAG,
        getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: course.slug }),
      ]),
    );
  });

  it("gives the next free position in a band and every chapter title of the course", async () => {
    const [course, beginner, advanced] = await Promise.all([
      courseFixture({ title: "Physics" }),
      libraryChapterFixture({ title: "Motion" }),
      libraryChapterFixture({ level: "advanced", title: "Fields" }),
    ]);

    await Promise.all([
      prisma.courseChapter.create({
        data: { chapterId: beginner.id, courseId: course.id, level: "beginner", position: 2 },
      }),
      prisma.courseChapter.create({
        data: { chapterId: advanced.id, courseId: course.id, level: "advanced", position: 0 },
      }),
    ]);

    const context = await getCourseBandContext({ courseId: course.id, level: "beginner" });

    expect(context.nextPosition).toBe(3);
    expect(context.chapterTitles.toSorted()).toStrictEqual(["Fields", "Motion"]);

    await expect(
      getCourseBandContext({ courseId: course.id, level: "intermediate" }),
    ).resolves.toMatchObject({ nextPosition: 0 });
  });
});

describe(replanGoalsWaitingOnSkills, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("replaces a skill's stand-in with its outlined lessons, in chapter order, and rebuilds today's session", async () => {
    const user = await userFixture();

    const [goal, first, second] = await Promise.all([
      goalFixture({ userId: user.id }),
      skillFixture(),
      skillFixture(),
    ]);

    const today = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

    await prisma.plan.create({
      data: { goalId: goal.id, settings: { startDate: today.toISOString().slice(0, 10) } },
    });

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Phase" }],
        skills: [
          {
            area: "Physics",
            lessons: 2,
            name: first.name,
            phase: 0,
            skillId: first.id,
            weight: null,
          },
          {
            area: "Physics",
            lessons: 2,
            name: second.name,
            phase: 0,
            skillId: second.id,
            weight: null,
          },
        ],
      },
    });

    const planned = await studySessionFixture({
      goalId: goal.id,
      localDate: today,
      userId: user.id,
    });

    const course = await courseFixture({ outlineStatus: "running" });
    const word = uniqueWord();

    const saved = await saveOutlineChapter({
      chapter: outlineChapter({
        lessons: [
          outlineLesson(`Part one ${word}`, [`Skill one ${word}`]),
          outlineLesson(`Part two ${word}`, [`Skill two ${word}`]),
        ],
        skillKeys: ["first"],
        title: `Chapter ${word}`,
      }),
      courseId: course.id,
      goalSkills: [
        { description: first.description, id: first.id, key: "first", name: first.name },
      ],
      level: "beginner",
      position: 0,
      provenance,
      scope,
      workflowRunId: randomUUID(),
    });

    await expect(replanGoalsWaitingOnSkills({ skillIds: [first.id] })).resolves.toStrictEqual([
      goal.id,
    ]);

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", plan: { goalId: goal.id } },
    });

    expect(items.map((item) => item.lessonId ?? item.skillId)).toStrictEqual([
      ...saved.lessonIds,
      second.id,
    ]);

    expect(items.slice(0, 2).every((item) => item.skillId === first.id)).toBe(true);
    await expect(prisma.studySession.findUnique({ where: { id: planned.id } })).resolves.toBeNull();
  });

  it("re-plans a goal re-planned from the band's first chapter again, so its later chapters' lessons join", async () => {
    const user = await userFixture();
    const [goal, skill] = await Promise.all([goalFixture({ userId: user.id }), skillFixture()]);
    const today = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

    const goalSkills = [
      { description: skill.description, id: skill.id, key: "only", name: skill.name },
    ];

    await prisma.plan.create({
      data: { goalId: goal.id, settings: { startDate: today.toISOString().slice(0, 10) } },
    });

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Phase" }],
        skills: [
          { area: null, lessons: 4, name: skill.name, phase: 0, skillId: skill.id, weight: null },
        ],
      },
    });

    const course = await courseFixture({ outlineStatus: "running" });

    const saveChapter = (position: number) => {
      const word = uniqueWord();

      return saveOutlineChapter({
        chapter: outlineChapter({
          lessons: [outlineLesson(`Part ${word}`, [`Skill ${word}`])],
          skillKeys: ["only"],
          title: `Chapter ${word}`,
        }),
        courseId: course.id,
        goalSkills,
        level: "beginner",
        position,
        provenance,
        scope,
        workflowRunId: randomUUID(),
      });
    };

    // The band's first chapter lands and the waiting learner is re-planned: no stand-in is left.
    const first = await saveChapter(0);
    const partway = await replanGoalsWaitingOnSkills({ skillIds: [skill.id] });
    const second = await saveChapter(1);

    await expect(
      replanGoalsWaitingOnSkills({ goalIds: partway, skillIds: [skill.id] }),
    ).resolves.toStrictEqual([goal.id]);

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", plan: { goalId: goal.id } },
    });

    expect(items.map((item) => item.lessonId)).toStrictEqual([
      ...first.lessonIds,
      ...second.lessonIds,
    ]);
  });
});
