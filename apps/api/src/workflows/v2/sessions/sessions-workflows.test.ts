import { generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { generatePlacementItems } from "@zoonk/ai/tasks/v2/items/placement-items";
import { classifyWorkField } from "@zoonk/ai/tasks/v2/items/work-field";
import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { generateStepVariant } from "@zoonk/ai/tasks/v2/variants/step-variant";
import { prisma } from "@zoonk/db";
import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { taskResult } from "../_test-utils/recorded-outputs";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { sessionPreparationWorkflow } from "./session-preparation-workflow";

const TIME_ZONE = "UTC";

/** A skill of a plan's graph, in its first phase. */
function graphSkill(area: string, skillId: string) {
  return { area, lessons: 1, name: skillId, phase: 0, skillId };
}

/** The model writes each skill's quick questions as asked, and no typed one. */
function writePlacementQuestions() {
  vi.mocked(generatePlacementItems).mockImplementation(async (params) =>
    taskResult({
      skills: params.skills.map(() => ({
        quick: Array.from({ length: params.quickCount }, (_, index) => ({
          context: null,
          difficulty: "medium" as const,
          fixedOrder: false,
          format: "multipleChoice" as const,
          image: null,
          options: [
            { isCorrect: true, misconception: null, reason: "Right.", text: "O nucléolo" },
            {
              isCorrect: false,
              misconception: "Troca as estruturas",
              reason: "No.",
              text: "A carioteca",
            },
          ],
          question: `Onde se formam os ribossomos? (${index})`,
          visual: null,
        })),
        typed: [],
      })),
    }),
  );
}

/**
 * An ICU nurse who installs nothing, with a lesson teaching a skill and the chapter's challenge in
 * today's session, both written. Models answer with a question, a tool version and a case.
 */
async function nurseWithWrittenLessons() {
  const user = await userFixture();
  const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

  const [goal, chapter, skill] = await Promise.all([
    goalFixture({ details: { purpose: "work", role: "ICU nurse" }, userId: user.id }),
    libraryChapterFixture({ tools: [{ essential: true, name: "Python" }] }),
    skillFixture(),
  ]);

  const [plan, session, taught, challenge] = await Promise.all([
    planFixture({ goalId: goal.id, settings: { tools: [{ choice: "none", name: "Python" }] } }),
    studySessionFixture({ goalId: goal.id, localDate: today, userId: user.id }),
    playableLessonFixture({ steps: ["explanation"] }),
    playableLessonFixture({
      lesson: {
        spec: {
          kind: "challenge",
          skills: [{ description: null, name: "Doses" }],
          variant: "work",
        },
      },
      steps: ["challenge"],
    }),
  ]);

  await Promise.all([
    lessonSkillFixture({ lessonId: taught.lesson.id, skillId: skill.id }),
    studySessionBlockFixture({ lessonId: taught.lesson.id, position: 0, sessionId: session.id }),
    studySessionBlockFixture({ lessonId: challenge.lesson.id, position: 1, sessionId: session.id }),
    planItemFixture({
      chapterId: chapter.id,
      lessonId: taught.lesson.id,
      planId: plan.id,
      position: 0,
    }),
    planItemFixture({
      chapterId: chapter.id,
      lessonId: challenge.lesson.id,
      planId: plan.id,
      position: 1,
    }),
  ]);

  vi.mocked(classifyWorkField).mockResolvedValue(taskResult({ field: "nursing" as const }));
  vi.mocked(generateChallengeCase).mockResolvedValue(taskResult(writtenChallengeCaseFixture()));

  vi.mocked(generateStepVariant).mockResolvedValue(
    taskResult({
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation" as const,
      text: "Here's what `python --version` prints: `Python 3.13.1`.",
      title: "What the terminal shows",
      visual: null,
    }),
  );

  vi.mocked(generateItems).mockResolvedValue(
    taskResult({
      items: [
        {
          context: "A patient's chart shows two doses a day.",
          difficulty: "easy" as const,
          fixedOrder: false,
          format: "multipleChoice" as const,
          image: null,
          options: [
            { isCorrect: true, misconception: null, reason: "Right.", text: "Twice a day" },
            {
              isCorrect: false,
              misconception: "Reads the dose as the count",
              reason: "No.",
              text: "Once",
            },
          ],
          question: "How often is it given?",
          visual: null,
        },
      ],
    }),
  );

  return { challenge, goal, skill, taught, user };
}

/** The personal versions and field questions stored for the nurse's two lessons. */
async function personalLayer({
  challenge,
  skill,
  taught,
}: Awaited<ReturnType<typeof nurseWithWrittenLessons>>) {
  const [versions, fieldItems] = await Promise.all([
    prisma.stepVariant.findMany({
      select: { key: true, kind: true, stepId: true },
      where: { stepId: { in: [taught.steps[0]?.id ?? "", challenge.steps[0]?.id ?? ""] } },
    }),
    prisma.item.count({ where: { field: "nursing", skillId: skill.id } }),
  ]);

  return { fieldItems, versions: versions.toSorted((a, b) => a.kind.localeCompare(b.kind)) };
}

describe(sessionPreparationWorkflow, () => {
  // The clock stops where each test starts: the session it sets up today is the one the preparation
  // reads, even when the test runs across midnight.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a content run for each unwritten lesson of today's session and the next study day, for the client that asked", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

    const [plan, session, todayLesson, written, tomorrowLesson] = await Promise.all([
      planFixture({ goalId: goal.id }),
      studySessionFixture({ goalId: goal.id, localDate: today, userId: user.id }),
      libraryLessonFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      studySessionBlockFixture({ lessonId: todayLesson.id, position: 0, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: written.id, position: 1, sessionId: session.id }),
      planItemFixture({
        lessonId: tomorrowLesson.id,
        planId: plan.id,
        scheduledFor: new Date(today.getTime() + 86_400_000),
      }),
    ]);

    const result = await sessionPreparationWorkflow({
      goalId: goal.id,
      platform: "ios",
      timeZone: TIME_ZONE,
      userId: user.id,
    });

    expect(result).toStrictEqual({
      laterLessonIds: [tomorrowLesson.id],
      lessonIds: [todayLesson.id],
      status: "prepared",
    });

    const analytics = { distinctId: user.id, goalId: goal.id, platform: "ios" };

    // Today's next lesson is minutes away, so it's written at the standard tier; tomorrow's is
    // hours away, so it's written at the flex tier, about half the price.
    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      { analytics, forExam: false, lessonId: todayLesson.id },
    ]);

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      { analytics, forExam: false, lessonId: tomorrowLesson.id, wait: "later" },
    ]);

    expect(vi.mocked(createHook)).toHaveBeenCalledWith({ token: `session-prep:${user.id}` });
  });

  it("writes the learner's personal layer over today's written lessons", async () => {
    const nurse = await nurseWithWrittenLessons();
    const { challenge, goal, taught, user } = nurse;

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(generateStepVariant).toHaveBeenCalledWith(
      expect.objectContaining({ key: "no-install" }),
    );

    expect(generateChallengeCase).toHaveBeenCalledWith(
      expect.objectContaining({ field: "nursing", variant: "work" }),
    );

    expect(generateItems).toHaveBeenCalledWith(expect.objectContaining({ field: "nursing" }));

    await expect(personalLayer(nurse)).resolves.toStrictEqual({
      fieldItems: 1,
      versions: [
        { key: "nursing", kind: "field", stepId: challenge.steps[0]?.id },
        { key: "no-install", kind: "tool", stepId: taught.steps[0]?.id },
      ],
    });
  });

  it("writes the personal layer over the lessons it started once they are written", async () => {
    const nurse = await nurseWithWrittenLessons();
    const { goal, taught, user } = nurse;

    // Today's first lesson isn't written yet: its run finishes while the preparation waits.
    await prisma.lesson.update({
      data: { contentStatus: "pending" },
      where: { id: taught.lesson.id },
    });

    vi.mocked(sleep).mockImplementationOnce(async () => {
      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: taught.lesson.id },
      });
    });

    await expect(
      sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toMatchObject({ lessonIds: [taught.lesson.id], status: "prepared" });

    await expect(personalLayer(nurse)).resolves.toMatchObject({
      versions: expect.arrayContaining([
        { key: "no-install", kind: "tool", stepId: taught.steps[0]?.id },
      ]),
    });
  });

  it("starts the lessons while another preparation is writing the learner's personal layer", async () => {
    const nurse = await nurseWithWrittenLessons();
    const { goal, taught, user } = nurse;

    await prisma.lesson.update({
      data: { contentStatus: "pending" },
      where: { id: taught.lesson.id },
    });

    // Only the personal layer's token is taken: another preparation is writing it.
    vi.mocked(createHook).mockImplementation(
      (options) =>
        ({
          [Symbol.dispose]: vi.fn(),
          dispose: vi.fn(),
          getConflict: () =>
            Promise.resolve(
              options?.token?.startsWith("session-personal:")
                ? { returnValue: Promise.resolve(null), runId: "personalizing-prep" }
                : null,
            ),
          token: options?.token ?? "generated-token",
        }) as unknown as ReturnType<typeof createHook>,
    );

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      expect.objectContaining({ lessonId: taught.lesson.id }),
    ]);

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("still writes the rest of the personal layer when one part of it fails", async () => {
    const nurse = await nurseWithWrittenLessons();
    const { challenge, goal, taught, user } = nurse;
    vi.mocked(generateItems).mockRejectedValue(new Error("Provider unavailable"));

    await expect(
      sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toMatchObject({ status: "prepared" });

    await expect(personalLayer(nurse)).resolves.toStrictEqual({
      fieldItems: 0,
      versions: [
        { key: "nursing", kind: "field", stepId: challenge.steps[0]?.id },
        { key: "no-install", kind: "tool", stepId: taught.steps[0]?.id },
      ],
    });
  });

  it("outlines at the flex tier the first chapters of a skill due soon that no course teaches yet", async () => {
    const user = await userFixture();
    const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

    const [goal, course, skill] = await Promise.all([
      goalFixture({ userId: user.id }),
      courseFixture({ outlineStatus: "completed" }),
      skillFixture(),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Base" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 4,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    // The plan stands in for the skill in three days; one due in a month waits for a later session.
    const [later] = await Promise.all([
      skillFixture(),
      planItemFixture({
        planId: plan.id,
        position: 0,
        scheduledFor: new Date(today.getTime() + 3 * 86_400_000),
        skillId: skill.id,
      }),
    ]);

    await planItemFixture({
      planId: plan.id,
      position: 1,
      scheduledFor: new Date(today.getTime() + 30 * 86_400_000),
      skillId: later.id,
    });

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({
        background: true,
        bands: [expect.objectContaining({ skills: [expect.objectContaining({ id: skill.id })] })],
        courseId: course.id,
      }),
    ]);

    expect(JSON.stringify(vi.mocked(start).mock.calls)).not.toContain(later.id);
  });

  // Lucas's first day held time for subjects whose lessons weren't outlined yet: their outlines,
  // started at the flex tier, landed minutes after he started his day. Carla's first chapter was
  // outlined by her session's preparation, which didn't say she was waiting on it, so it wasn't
  // saved before the rest of its band: her Today waited for all of it.
  it("outlines today's stand-in as the band the learner waits on, at the standard tier", async () => {
    const user = await userFixture();
    const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

    const [goal, course, skill] = await Promise.all([
      goalFixture({ userId: user.id }),
      courseFixture({ outlineStatus: "completed" }),
      skillFixture(),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Base" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 4,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    await planItemFixture({ planId: plan.id, position: 0, scheduledFor: today, skillId: skill.id });

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({ background: false, courseId: course.id, waitedSkillId: skill.id }),
    ]);
  });

  it.each([
    { background: true, days: 1, when: "tomorrow" },
    { background: false, days: 0, when: "today" },
  ])(
    "outlines the next chapter of a language skill whose stand-in is due $when",
    async ({ background, days }) => {
      const user = await userFixture();
      const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

      const [course, skill, chapter, lesson] = await Promise.all([
        courseFixture({ language: "pt", outlineStatus: "completed", targetLanguage: "en" }),
        skillFixture({ language: "pt", targetLanguage: "en" }),
        libraryChapterFixture({ language: "pt", targetLanguage: "en" }),
        libraryLessonFixture({ language: "pt", targetLanguage: "en" }),
      ]);

      const goal = await goalFixture({
        kind: "language",
        language: "pt",
        primaryCourseId: course.id,
        targetLanguage: "en",
        userId: user.id,
      });

      const plan = await planFixture({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Trabalho" }],
          skills: [
            {
              area: null,
              courseIds: [course.id],
              lessons: 12,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            },
          ],
        },
      });

      // The course teaches the skill in one lesson; the plan stands in for the other eleven: today's
      // time waits on their chapter, so only tomorrow's is written at the flex tier.
      await Promise.all([
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
        prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
        planItemFixture({
          planId: plan.id,
          position: 0,
          scheduledFor: new Date(today.getTime() + days * 86_400_000),
          skillId: skill.id,
        }),
      ]);

      await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

      const ref = {
        area: null,
        description: skill.description,
        id: skill.id,
        key: skill.id,
        name: skill.name,
      };

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        {
          analytics: { distinctId: user.id, goalId: goal.id },
          background,
          ...(background ? {} : { waitedSkillId: skill.id }),
          bands: [
            {
              extend: [{ lessons: 11, skill: ref }],
              level: "beginner",
              skills: [],
              withToolChapters: true,
            },
          ],
          courseId: course.id,
          // A shared course's outline sees the goal's title, never the learner's own prompt.
          scope: {
            exams: [],
            generalGoal: goal.title,
            language: course.language,
            ownerId: null,
            targetLanguage: course.targetLanguage,
          },
        },
      ]);
    },
  );

  it("writes a language goal's next checkpoint call ahead, so opening it never waits", async () => {
    const { goal, plan, renting, user } = await languageGoalFixture();

    await Promise.all([
      planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
      prisma.languageSkillLevel.create({
        data: { language: "en", score: 2, skill: "speaking", startScore: 2, userId: user.id },
      }),
    ]);

    vi.mocked(generateConversationScenario).mockResolvedValue(
      taskResult({ ...RENTING_SCENARIO, title: "Negociar o aluguel" }),
    );

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(generateConversationScenario).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ unitTitle: renting.title }),
    );
  });

  // One right answer frees a topic from its lessons, never from practice: Pedro's nucleus topic had only
  // the placement question he answered, so practice could never confirm it.
  it("writes a few questions for a topic the learner was taken to know that practice can't ask", async () => {
    const user = await userFixture();

    const [goal, nucleus] = await Promise.all([
      goalFixture({ userId: user.id }),
      skillFixture({ name: "Identificar as funções do núcleo" }),
    ]);

    await planFixture({ goalId: goal.id });

    writePlacementQuestions();

    await sessionPreparationWorkflow({
      claimQuestions: { format: "multipleChoice", questionsPerSkill: 3, skillIds: [nucleus.id] },
      goalId: goal.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });

    expect(generatePlacementItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        quickCount: 3,
        quickFormat: "multipleChoice",
        skills: [expect.objectContaining({ name: nucleus.name })],
        typedCount: 0,
      }),
    );

    await expect(
      prisma.item.count({ where: { format: "multipleChoice", skillId: nucleus.id } }),
    ).resolves.toBe(3);
  });

  // Rafaela's placement ran on the plan built before the notice was read; the notice's English and
  // IT came after it, with no placement question, so her first week never placed her in them.
  it("writes the placement questions a subject the plan gained after placement lacks, in placement's first week only", async () => {
    const user = await userFixture();

    const [goal, reading, english] = await Promise.all([
      goalFixture({ userId: user.id }),
      skillFixture({ name: "Interpretar textos" }),
      skillFixture({ name: "Ler textos em inglês" }),
    ]);

    await Promise.all([
      planFixture({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Fundamentos" }],
          skills: [
            graphSkill("Língua Portuguesa", reading.id),
            graphSkill("Língua Inglesa", english.id),
          ],
        },
      }),
      // Day 1's placement wrote Portuguese its question.
      itemFixture({ skillId: reading.id }),
    ]);

    writePlacementQuestions();

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    // Nobody waits: the next days' sessions ask it, so it's written at the flex tier.
    expect(generatePlacementItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        serviceTier: "flex",
        skills: [expect.objectContaining({ name: english.name })],
      }),
    );

    await expect(prisma.item.count({ where: { skillId: english.id } })).resolves.toBe(1);

    // Past placement's first week, lessons and reviews place the learner instead.
    vi.mocked(generatePlacementItems).mockClear();

    await Promise.all([
      prisma.goal.update({
        data: { createdAt: new Date(Date.now() - 8 * 86_400_000) },
        where: { id: goal.id },
      }),
      prisma.item.deleteMany({ where: { skillId: english.id } }),
    ]);

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(generatePlacementItems).not.toHaveBeenCalled();
  });

  it("leaves the learner's lessons to a preparation that is already running", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    mockHookConflict({ returnValue: Promise.resolve(null), runId: "running-prep" });

    await expect(
      sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toStrictEqual({ status: "alreadyRunning" });

    expect(start).not.toHaveBeenCalled();
  });
});
