import { generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
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
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { taskResult } from "../_test-utils/recorded-outputs";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { sessionPreparationWorkflow } from "./session-preparation-workflow";
import type * as StepVariantTask from "@zoonk/ai/tasks/v2/variants/step-variant";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// Model calls are external: the personal layer's versions and questions come back as recorded.
vi.mock("@zoonk/ai/tasks/v2/challenge/case", () => ({ generateChallengeCase: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/items/generate", () => ({ generateItems: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/items/work-field", () => ({ classifyWorkField: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/language/conversation-scenario", () => ({
  generateConversationScenario: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/variants/step-variant", async (importOriginal) => ({
  ...(await importOriginal<typeof StepVariantTask>()),
  generateStepVariant: vi.fn(),
}));

const TIME_ZONE = "UTC";

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
      expect.objectContaining({ key: "no-install", variant: "tool" }),
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
  // started at the flex tier, landed minutes after he started his day.
  it("outlines at the standard tier the chapters of a skill the plan stands in for today", async () => {
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
      expect.objectContaining({ background: false, courseId: course.id }),
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

      const ref = { description: skill.description, id: skill.id, key: skill.id, name: skill.name };

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        {
          analytics: { distinctId: user.id, goalId: goal.id },
          background,
          bands: [
            {
              extend: [{ lessons: 11, skill: ref }],
              level: "beginner",
              skills: [],
              withToolChapters: true,
            },
          ],
          courseId: course.id,
          scope: { generalGoal: null, language: "pt", ownerId: null, targetLanguage: "en" },
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
