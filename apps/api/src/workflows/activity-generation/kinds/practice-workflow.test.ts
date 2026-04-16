import { randomUUID } from "node:crypto";
import { generateActivityPractice } from "@zoonk/ai/tasks/activities/core/practice";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { practiceActivityWorkflow } from "./practice-workflow";

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({
    data: {
      steps: [
        {
          context: "Your colleague turns to you during a meeting...",
          options: [
            { feedback: "Great choice!", isCorrect: true, text: "Option A" },
            { feedback: "Not quite.", isCorrect: false, text: "Option B" },
            { feedback: "Try again.", isCorrect: false, text: "Option C" },
            { feedback: "Nope.", isCorrect: false, text: "Option D" },
          ],
          question: "What should you do?",
        },
      ],
    },
  }),
}));

function buildExplanationResults(activityId: string): ExplanationResult[] {
  return [
    {
      activityId,
      concept: "Test Concept",
      steps: [
        { text: "Explanation step 1", title: "Step 1" },
        { text: "Explanation step 2", title: "Step 2" },
      ],
    },
  ];
}

describe("practice activity workflow", () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Practice WF Chapter ${randomUUID()}`,
    });
  });

  test("creates practice steps with multipleChoice kind", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Practice Content Lesson ${randomUUID()}`,
    });

    const expActivity = await activityFixture({
      generationStatus: "completed",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Test Concept",
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      lessonId: testLesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(expActivity.id);

    await practiceActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      explanationResults,
      totalPractices: 1,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]?.isPublished).toBe(true);
    expect(steps[0]?.kind).toBe("multipleChoice");
    expect(steps[0]?.content).toEqual({
      context: "Your colleague turns to you during a meeting...",
      kind: "core",
      options: [
        { feedback: "Great choice!", isCorrect: true, text: "Option A" },
        { feedback: "Not quite.", isCorrect: false, text: "Option B" },
        { feedback: "Try again.", isCorrect: false, text: "Option C" },
        { feedback: "Nope.", isCorrect: false, text: "Option D" },
      ],
      question: "What should you do?",
    });
  });

  test("sets practice status to 'completed' after saving", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Practice Completed Lesson ${randomUUID()}`,
    });

    const expActivity = await activityFixture({
      generationStatus: "completed",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Test Concept",
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      lessonId: testLesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(expActivity.id);

    await practiceActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      explanationResults,
      totalPractices: 1,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets practice status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityPractice).mockRejectedValueOnce(
      new Error("Practice generation failed"),
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Practice Failed Lesson ${randomUUID()}`,
    });

    const expActivity = await activityFixture({
      generationStatus: "completed",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Test Concept",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      lessonId: testLesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(expActivity.id);

    await practiceActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      explanationResults,
      totalPractices: 1,
      workflowRunId: "test-run-id",
    });

    const dbPractice = await prisma.activity.findFirst({
      where: { kind: "practice", lessonId: testLesson.id },
    });
    expect(dbPractice?.generationStatus).toBe("failed");
  });

  test("sets practice status to 'failed' when explanation results are empty", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: [],
      organizationId,
      title: `Practice No Explanations Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      lessonId: testLesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

    await practiceActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      explanationResults: [],
      totalPractices: 1,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("skips if already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Practice Skip Lesson ${randomUUID()}`,
    });

    const expActivity = await activityFixture({
      generationStatus: "completed",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Test Concept",
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "practice",
      lessonId: testLesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        context: "Existing context",
        kind: "core",
        options: [{ feedback: "Yes", isCorrect: true, text: "A" }],
        question: "Existing?",
      },
      kind: "multipleChoice",
      position: 0,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const explanationResults = buildExplanationResults(expActivity.id);

    await practiceActivityWorkflow({
      activitiesToGenerate: [],
      allActivities: activities,
      explanationResults,
      totalPractices: 1,
      workflowRunId: "test-run-id",
    });

    expect(generateActivityPractice).not.toHaveBeenCalled();
  });

  describe("multi-practice behavior", () => {
    test("creates two practices when lesson has 4+ concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["S1", "S2", "S3", "S4"],
        organizationId,
        title: `Two Practice Lesson ${randomUUID()}`,
      });

      const [expS1, expS2, expS3, expS4] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "S1",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "S2",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "S3",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "S4",
        }),
      ]);

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Practice 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Practice 2 ${randomUUID()}`,
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const explanationResults: ExplanationResult[] = [
        { activityId: expS1.id, concept: "S1", steps: [{ text: "S1 text", title: "S1" }] },
        { activityId: expS2.id, concept: "S2", steps: [{ text: "S2 text", title: "S2" }] },
        { activityId: expS3.id, concept: "S3", steps: [{ text: "S3 text", title: "S3" }] },
        { activityId: expS4.id, concept: "S4", steps: [{ text: "S4 text", title: "S4" }] },
      ];

      await practiceActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        explanationResults,
        totalPractices: 2,
        workflowRunId: "test-run-id",
      });

      expect(generateActivityPractice).toHaveBeenCalledTimes(2);
    });

    test("practice 1 gets first half of explanation steps, practice 2 gets second half", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Half1A", "Half1B", "Half2A", "Half2B"],
        organizationId,
        title: `Practice Split Lesson ${randomUUID()}`,
      });

      const [expH1A, expH1B, expH2A, expH2B] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Half1A",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Half1B",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Half2A",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "Half2B",
        }),
      ]);

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Practice 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Practice 2 ${randomUUID()}`,
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const explanationResults: ExplanationResult[] = [
        {
          activityId: expH1A.id,
          concept: "Half1A",
          steps: [{ text: "H1A text", title: "H1A" }],
        },
        {
          activityId: expH1B.id,
          concept: "Half1B",
          steps: [{ text: "H1B text", title: "H1B" }],
        },
        {
          activityId: expH2A.id,
          concept: "Half2A",
          steps: [{ text: "H2A text", title: "H2A" }],
        },
        {
          activityId: expH2B.id,
          concept: "Half2B",
          steps: [{ text: "H2B text", title: "H2B" }],
        },
      ];

      await practiceActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        explanationResults,
        totalPractices: 2,
        workflowRunId: "test-run-id",
      });

      expect(generateActivityPractice).toHaveBeenCalledTimes(2);

      // Practice 1 should get first half explanation steps (H1A, H1B)
      expect(generateActivityPractice).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "H1A text", title: "H1A" },
            { text: "H1B text", title: "H1B" },
          ],
        }),
      );

      // Practice 2 should get second half explanation steps (H2A, H2B)
      expect(generateActivityPractice).toHaveBeenCalledWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "H2A text", title: "H2A" },
            { text: "H2B text", title: "H2B" },
          ],
        }),
      );
    });

    test("single practice gets all explanation steps when < 4 concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Single A", "Single B"],
        organizationId,
        title: `Single Practice Lesson ${randomUUID()}`,
      });

      const [expSA, expSB] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Single A",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Single B",
        }),
      ]);

      await activityFixture({
        generationStatus: "pending",
        kind: "practice",
        lessonId: testLesson.id,
        organizationId,
        position: 3,
        title: `Single Practice ${randomUUID()}`,
      });

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const explanationResults: ExplanationResult[] = [
        {
          activityId: expSA.id,
          concept: "Single A",
          steps: [{ text: "SA text", title: "SA" }],
        },
        {
          activityId: expSB.id,
          concept: "Single B",
          steps: [{ text: "SB text", title: "SB" }],
        },
      ];

      await practiceActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        explanationResults,
        totalPractices: 1,
        workflowRunId: "test-run-id",
      });

      expect(generateActivityPractice).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "SA text", title: "SA" },
            { text: "SB text", title: "SB" },
          ],
        }),
      );
    });

    test("completes both practice activities when lesson has two practices", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["SC1", "SC2", "SC3", "SC4"],
        organizationId,
        title: `Both Practices Complete Lesson ${randomUUID()}`,
      });

      const [expSC1, expSC2, expSC3, expSC4] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "SC1",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "SC2",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "SC3",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "SC4",
        }),
      ]);

      const [practice1, practice2] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Practice Complete 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Practice Complete 2 ${randomUUID()}`,
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const explanationResults: ExplanationResult[] = [
        {
          activityId: expSC1.id,
          concept: "SC1",
          steps: [{ text: "SC1 text", title: "SC1" }],
        },
        {
          activityId: expSC2.id,
          concept: "SC2",
          steps: [{ text: "SC2 text", title: "SC2" }],
        },
        {
          activityId: expSC3.id,
          concept: "SC3",
          steps: [{ text: "SC3 text", title: "SC3" }],
        },
        {
          activityId: expSC4.id,
          concept: "SC4",
          steps: [{ text: "SC4 text", title: "SC4" }],
        },
      ];

      await practiceActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        explanationResults,
        totalPractices: 2,
        workflowRunId: "test-run-id",
      });

      const [dbPractice1, dbPractice2] = await Promise.all([
        prisma.activity.findUnique({ where: { id: practice1.id } }),
        prisma.activity.findUnique({ where: { id: practice2.id } }),
      ]);

      expect(dbPractice1?.generationStatus).toBe("completed");
      expect(dbPractice2?.generationStatus).toBe("completed");
    });

    test("uses correct explanation slice when only practice 1 (of 2) needs regeneration", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["IdxA", "IdxB", "IdxC", "IdxD"],
        organizationId,
        title: `Practice Index Alignment ${randomUUID()}`,
      });

      const [expIdxA, expIdxB, expIdxC, expIdxD] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "IdxA",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "IdxB",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "IdxC",
        }),
        activityFixture({
          generationStatus: "completed",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 4,
          title: "IdxD",
        }),
      ]);

      const [practice0, practice1] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 5,
          title: `Practice 0 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 6,
          title: `Practice 1 ${randomUUID()}`,
        }),
      ]);

      // practice0 is completed → only practice1 in activitiesToGenerate
      const allActivities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const activitiesToGenerate = allActivities.filter((a) => a.id === practice1.id);

      const explanationResults: ExplanationResult[] = [
        {
          activityId: expIdxA.id,
          concept: "IdxA",
          steps: [{ text: "IdxA text", title: "IdxA" }],
        },
        {
          activityId: expIdxB.id,
          concept: "IdxB",
          steps: [{ text: "IdxB text", title: "IdxB" }],
        },
        {
          activityId: expIdxC.id,
          concept: "IdxC",
          steps: [{ text: "IdxC text", title: "IdxC" }],
        },
        {
          activityId: expIdxD.id,
          concept: "IdxD",
          steps: [{ text: "IdxD text", title: "IdxD" }],
        },
      ];

      await practiceActivityWorkflow({
        activitiesToGenerate,
        allActivities,
        explanationResults,
        totalPractices: 2,
        workflowRunId: "test-run-id",
      });

      // Practice 1 (index 1 in allPractices) should get the SECOND half
      // of explanations (IdxC, IdxD), not the first half or all of them.
      expect(generateActivityPractice).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          explanationSteps: [
            { text: "IdxC text", title: "IdxC" },
            { text: "IdxD text", title: "IdxD" },
          ],
        }),
      );

      // Practice 0 was skipped (completed), practice 1 should be completed
      const [dbPractice0, dbPractice1] = await Promise.all([
        prisma.activity.findUnique({ where: { id: practice0.id } }),
        prisma.activity.findUnique({ where: { id: practice1.id } }),
      ]);
      expect(dbPractice0?.generationStatus).toBe("completed");
      expect(dbPractice1?.generationStatus).toBe("completed");
    });

    test("practice 1 gets content when only one explanation result exists with two practices", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["OnlyConcept"],
        organizationId,
        title: `Single Explanation Two Practices ${randomUUID()}`,
      });

      const expOnly = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: "OnlyConcept",
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: `Practice 1 ${randomUUID()}`,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "practice",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: `Practice 2 ${randomUUID()}`,
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const explanationResults: ExplanationResult[] = [
        {
          activityId: expOnly.id,
          concept: "OnlyConcept",
          steps: [{ text: "Only text", title: "Only" }],
        },
      ];

      await practiceActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        explanationResults,
        totalPractices: 2,
        workflowRunId: "test-run-id",
      });

      // Practice 1 must get the single explanation result (not an empty array)
      expect(generateActivityPractice).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          explanationSteps: [{ text: "Only text", title: "Only" }],
        }),
      );
    });
  });
});
