import { randomUUID } from "node:crypto";
import { del, list } from "@vercel/blob";
import { type QuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { auth } from "@zoonk/auth";
import { deleteUserDependenciesBeforeAuthDelete } from "@zoonk/auth/account-deletion";
import { registerEvaluationRunLog } from "@zoonk/core/evaluation-runs/log";
import {
  copyStoredCourseWeights,
  recordCourseWeights,
} from "@zoonk/core/goals/course-weights-research";
import { loadGoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { loadLessonSpecInputs } from "@zoonk/core/library/curriculum/lesson-spec-inputs";
import {
  findReusableCurriculum,
  saveExamSkillGraph,
} from "@zoonk/core/library/curriculum/reusable-curriculum";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { toExplanationSteps } from "@zoonk/core/library/explanations/explanation-steps";
import {
  findExplanationGoFurther,
  linkExplanationToGoal,
  linkGoFurtherCourse,
  saveExplanationLesson,
} from "@zoonk/core/library/explanations/save";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { feedbackFixture } from "@zoonk/testing/fixtures/feedback";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { chapterSkillFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  answerExplanationFixture,
  libraryStepFixture,
  mediaAssetFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceChangeNoticeFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteAccount } from "./route";

const PRIVATE_STORE = "https://store.private.blob.vercel-storage.com";

const SHARED: CurriculumScope = {
  generalGoal: "Public servant exam",
  language: "en",
  ownerId: null,
  targetLanguage: null,
};

const provenance = { generatedAt: new Date(), model: "test/model", promptVersion: "v1" };

const MOCK_FINISHED_AT = new Date("2026-09-20T15:42:17.123Z");
const LESSON_ENDED_AT = new Date("2026-09-21T09:13:51.456Z");
const RESULT_REPORTED_AT = new Date("2026-11-10T21:07:33.789Z");
const FEEDBACK = "The timer froze on question 12";

const COURSE_WEIGHTS_TARGET = {
  course: "Direito",
  exam: "Test Exam",
  institution: "UnB",
  key: "course:direito|unb",
  subjects: ["Test subject"],
  year: 2026,
};

type Learner = Awaited<ReturnType<typeof userFixture>>;

function toCookieHeaders(responseHeaders: Headers) {
  const cookie = responseHeaders
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return new Headers({ cookie });
}

async function deleteOwnAccount(learner: Learner) {
  const signIn = await auth.api.signInEmail({
    body: { email: learner.email, password: learner.password },
    returnHeaders: true,
  });

  vi.mocked(headers).mockResolvedValue(
    toCookieHeaders(signIn.headers) as Awaited<ReturnType<typeof headers>>,
  );

  const response = await deleteAccount(
    new NextRequest("http://localhost/v1/me", { body: "{}", method: "DELETE" }),
  );

  expect(response.status).toBe(200);
}

function explanation(): QuickExplanation {
  return {
    check: {
      options: [
        { feedback: "Yes: it's a basket.", isCorrect: true, text: "The basket is worth more" },
        { feedback: "No: some fall.", isCorrect: false, text: "Every stock rose" },
        { feedback: "No: points are a unit.", isCorrect: false, text: "It gained 2 points" },
      ],
      question: "The market is up 2% today. What happened?",
    },
    goFurther: {
      overviewCourse: "How the stock market works",
      relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
    },
    recap: ["The market is an index.", "Big companies weigh more.", "Up 2% is since yesterday."],
    screens: [
      { imagePrompt: null, text: "“The market” is an **index**.", title: "Not one price" },
      { imagePrompt: null, text: "Each company counts by size.", title: "Bigger weighs more" },
      { imagePrompt: null, text: "It compares with yesterday.", title: "Up since when?" },
      { imagePrompt: null, text: "An index fund follows it.", title: "Why it matters" },
    ],
    title: "What “the market is up 2%” means",
  };
}

async function askGeneralQuestion(userId: string) {
  const [goal, skill, organization] = await Promise.all([
    goalFixture({ details: { question: "what is the market?" }, kind: "explain", userId }),
    skillFixture(),
    aiOrganizationFixture(),
  ]);

  const [course] = await Promise.all([
    courseFixture({ organizationId: organization.id, visibility: "public" }),
    planFixture({ goalId: goal.id }),
  ]);

  const written = explanation();

  const saved = await saveExplanationLesson({
    explanation: written,
    provenance: { ...provenance, runId: randomUUID() },
    scope: { language: "en", ownerId: null },
    skillId: skill.id,
    steps: toExplanationSteps(written).steps,
    workflowRunId: randomUUID(),
  });

  await linkExplanationToGoal({
    courseId: null,
    goalId: goal.id,
    relatedQuestions: written.goFurther.relatedQuestions,
    skill: { id: skill.id, name: skill.name },
    title: written.title,
  });

  await linkGoFurtherCourse({ courseId: course.id, goalId: goal.id, lessonId: saved.lessonId });

  return { course, lessonId: saved.lessonId, skill };
}

async function studyLaw({ chapterId, userId }: { chapterId: string; userId: string }) {
  const [goal, law] = await Promise.all([
    goalFixture({ prompt: "Lei 8.112", title: "Lei 8.112", userId }),
    sourceFixture({
      extractedText:
        "Art. 13. A posse do servidor público ocorre no prazo de trinta dias. Art. 15. O exercício do servidor público começa em quinze dias contados da posse.",
      title: "Lei nº 8.112, de 11 de dezembro de 1990",
    }),
  ]);

  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    description: "Prazos da posse e do exercício do servidor público",
    homeChapterId: chapterId,
    title: "Posse e exercício do servidor público",
  });

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    chapterLessonFixture({ chapterId, lessonId: lesson.id }),
    libraryStepFixture({ lessonId: lesson.id, sourceId: law.id }),
    planItemFixture({ lessonId: lesson.id, planId: plan.id }),
    learnerSourceFixture({ goalId: goal.id, origin: "research", sourceId: law.id, userId }),
  ]);

  return { law, lesson };
}

async function prepareForExam({
  courseId,
  lessonId,
  skillId,
  userId,
}: {
  courseId: string;
  lessonId: string;
  skillId: string;
  userId: string;
}) {
  const notice = await sourceFixture({ title: "Edital do concurso" });
  const blueprint = await examBlueprintFixture({ sourceId: notice.id });

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId });

  const [plan, changeNotice, cutoff, pastQuestion] = await Promise.all([
    planFixture({ goalId: goal.id }),
    sourceChangeNoticeFixture({ examBlueprintId: blueprint.id, sourceId: notice.id }),
    prisma.targetCutoff.create({
      data: {
        examBlueprintId: blueprint.id,
        model: "test/model",
        promptVersion: "v1",
        runId: randomUUID(),
        score: 712.4,
        status: "found",
        targetKey: "medicina ufmg",
        year: 2026,
      },
    }),
    itemFixture({ examBlueprintId: blueprint.id, skillId, sourceId: notice.id }),
  ]);

  const reviewFlag = await prisma.contentReviewFlag.create({
    data: { lessonId, noticeId: changeNotice.id },
  });

  const inputs = await loadGoalCurriculumInputs(goal.id);

  if (!inputs) {
    throw new Error("The exam goal's curriculum inputs couldn't be read.");
  }

  await saveExamSkillGraph({
    graph: {
      phases: [{ milestone: "Know the basics", name: "Foundations" }],
      skills: [
        {
          area: "Law",
          courseIds: [courseId],
          lessons: 2,
          name: "Know the deadlines",
          phase: 0,
          skillId,
          weight: 2,
        },
      ],
    },
    inputs,
    provenance: { ...provenance, runId: randomUUID() },
    scope: SHARED,
  });

  await recordCourseWeights({
    finding: {
      edition: "SISU 2026",
      source: { title: "Pesos", url: "https://www.unb.br/pesos" },
      status: "found",
      weights: [2],
    },
    goalId: goal.id,
    lookup: { ...COURSE_WEIGHTS_TARGET, examBlueprintId: blueprint.id },
    provenance: { ...provenance, runId: randomUUID() },
  });

  return { blueprint, changeNotice, cutoff, goal, notice, pastQuestion, plan, reviewFlag };
}

async function logEvaluationRuns({ goalId, userId }: { goalId: string; userId: string }) {
  registerEvaluationRunLog();

  const run = {
    answers: { reuse: { probability: 0.9, type: "boolean" as const } },
    distinctId: userId,
    goalId,
    latencyMs: 120,
    model: "typesafe-ai/jev",
    promptVersion: "v1",
    requestedModel: "typesafe-ai/jev",
    runId: randomUUID(),
  };

  const shared = { inputHash: `shared-${randomUUID()}`, task: "library-identity-decision" };
  const personal = { inputHash: `personal-${randomUUID()}`, task: "question-generality" };

  await globalThis.zoonkEvaluationRunSink?.({
    ...run,
    ...shared,
    contentScope: "shared",
    input: { SUBJECT: "Prazos de posse" },
  });

  await globalThis.zoonkEvaluationRunSink?.({
    ...run,
    ...personal,
    contentScope: "personal",
    input: { QUESTION: "Can I take office after 40 days if I'm sick?" },
  });

  return { personalHash: personal.inputHash, sharedHash: shared.inputHash };
}

async function learnerWithSharedContent() {
  const learner = await userFixture();
  const userId = learner.id;

  const [catalog, skill, prerequisite, organization] = await Promise.all([
    catalogCourseFixture({ lessonCounts: [1] }),
    skillFixture(),
    skillFixture(),
    aiOrganizationFixture(),
  ]);

  const chapter = catalog.chapters[0];
  const lesson = catalog.lessons[0]?.[0];

  if (!chapter || !lesson) {
    throw new Error("The catalog course has no lesson.");
  }

  const [picture, audio, word] = await Promise.all([
    mediaAssetFixture({ url: "https://public.blob.vercel-storage.com/library/images/a.webp" }),
    mediaAssetFixture({
      kind: "audio",
      url: "https://public.blob.vercel-storage.com/library/audio/a.mp3",
    }),
    wordFixture({
      audioUrl: "https://public.blob.vercel-storage.com/library/audio/word.mp3",
      organizationId: organization.id,
    }),
  ]);

  const step = await libraryStepFixture({
    lessonId: lesson.id,
    mediaAssetId: picture.id,
    skillId: skill.id,
  });

  const [item, variant, stepExplanation, optionPicture, sharedAnswer, mindMap, scenario] =
    await Promise.all([
      itemFixture({ mediaAssetId: picture.id, skillId: skill.id }),
      stepVariantFixture({ stepId: step.id }),
      answerExplanationFixture({ stepId: step.id }),
      prisma.stepOptionPicture.create({
        data: { mediaAssetId: picture.id, optionId: "a", stepId: step.id },
      }),
      prisma.tutorSharedAnswer.create({
        data: {
          answer: "Because the index is a basket.",
          model: "test/model",
          promptVersion: "v1",
          question: "Explain it more simply",
          runId: randomUUID(),
          stepId: step.id,
          suggestion: "simpler",
        },
      }),
      prisma.chapterMindMap.create({
        data: {
          chapterId: chapter.id,
          imageUrl: "https://public.blob.vercel-storage.com/library/mind-maps/map.webp",
          language: "en",
          status: "completed",
        },
      }),
      prisma.conversationScenario.create({
        data: {
          chapterId: chapter.id,
          content: { character: "A shop owner" },
          level: "A2",
          model: "test/model",
          promptVersion: "v1",
          runId: randomUUID(),
        },
      }),
      skillPrerequisiteFixture({ prerequisiteId: prerequisite.id, skillId: skill.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    ]);

  const itemExplanation = await answerExplanationFixture({ itemId: item.id });

  const [exam, law, quick, publicUpload, privateCourse, privateSkill] = await Promise.all([
    prepareForExam({ courseId: catalog.course.id, lessonId: lesson.id, skillId: skill.id, userId }),
    studyLaw({ chapterId: chapter.id, userId }),
    askGeneralQuestion(userId),
    sourceFixture({
      blobUrl: `${PRIVATE_STORE}/sources/${userId}/edital.pdf`,
      kind: "upload",
      title: "Edital uploaded",
    }),
    privateCourseFixture({ lessonCounts: [1], ownerId: userId }),
    skillFixture({ ownerId: userId, visibility: "private" }),
  ]);

  const [privatePicture, privateUpload, privateBlueprint] = await Promise.all([
    mediaAssetFixture({
      ownerId: userId,
      url: `${PRIVATE_STORE}/images/${userId}/course.webp`,
      visibility: "private",
    }),
    sourceFixture({
      blobUrl: `${PRIVATE_STORE}/sources/${userId}/slides.pdf`,
      kind: "upload",
      ownerId: userId,
      title: "My class slides",
      visibility: "private",
    }),
    examBlueprintFixture({ ownerId: userId, visibility: "private" }),
  ]);

  const session = await studySessionFixture({ goalId: exam.goal.id, userId });

  const thread = await prisma.lessonQuestionThread.create({
    data: { libraryLessonId: lesson.id, userId },
  });

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {},
      examBlueprintId: exam.blueprint.id,
      finishedAt: MOCK_FINISHED_AT,
      goalId: exam.goal.id,
      sectionStartedAt: MOCK_FINISHED_AT,
      status: "finished",
      userId,
    },
  });

  const aiCallRunId = randomUUID();

  const [attempt, evaluationRuns, mockAttempt, feedback, signedOutFeedback] = await Promise.all([
    attemptFixture({ itemId: item.id, skillId: skill.id, stepId: step.id, userId }),
    logEvaluationRuns({ goalId: exam.goal.id, userId }),
    attemptFixture({
      answeredAt: MOCK_FINISHED_AT,
      durationMs: 95_000,
      isCorrect: false,
      itemId: exam.pastQuestion.id,
      mockExamId: mock.id,
      userId,
    }),
    feedbackFixture({ email: learner.email, message: FEEDBACK, userId }),
    feedbackFixture({ email: learner.email.toUpperCase(), message: FEEDBACK }),
    attemptFixture({
      answeredAt: new Date("2026-09-01T10:00:00Z"),
      isCorrect: false,
      itemId: item.id,
      userId,
    }),
    learningEventFixture({
      contentIds: { lessonId: lesson.id },
      endedAt: LESSON_ENDED_AT,
      goalId: exam.goal.id,
      seconds: 200,
      titleSnapshot: lesson.title,
      userId,
    }),
    learningEventFixture({ endedAt: LESSON_ENDED_AT, goalId: exam.goal.id, kind: "mock", userId }),
    planItemFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      planId: exam.plan.id,
      skillId: skill.id,
    }),
    studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id }),
    learnerSkillFixture({ skillId: skill.id, userId }),
    learnerSkillFixture({ skillId: privateSkill.id, userId }),
    itemFixture({ skillId: privateSkill.id }),
    mistakeFixture({ itemId: item.id, skillId: skill.id, stepId: step.id, userId }),
    memoryFactFixture({ userId }),
    goalUnderstandingFixture({
      goal: "passar no concurso para direito na unb, tenho 17 anos",
      result: {
        followUps: [],
        goals: [{ kind: "exam", subject: "Direito", title: "Passar" }],
        route: "goals",
      },
      userId,
    }),
    learnerSourceFixture({ origin: "upload", sourceId: publicUpload.id, userId }),
    learnerSourceFixture({ origin: "upload", sourceId: privateUpload.id, userId }),
    prisma.stepExampleLine.create({
      data: {
        contextKey: "facts-1",
        model: "test/model",
        promptVersion: "v1",
        runId: randomUUID(),
        stepId: step.id,
        text: "Like the basket of fruit you buy every week.",
        userId,
      },
    }),
    prisma.lessonQuestion.create({
      data: {
        answer: "Because the index is a basket.",
        contextKind: "step",
        contextSnapshot: {},
        libraryStepId: step.id,
        question: "Explain it more simply",
        requestFingerprint: "fingerprint",
        requestId: randomUUID(),
        sharedAnswerId: sharedAnswer.id,
        status: "completed",
        suggestion: "simpler",
        threadId: thread.id,
      },
    }),
    prisma.examResult.create({
      data: {
        estimateHigh: 700,
        estimateLow: 640,
        examBlueprintId: exam.blueprint.id,
        examName: "Test Exam",
        goalId: exam.goal.id,
        reportedAt: RESULT_REPORTED_AT,
        scale: "irt",
        score: 690,
        userId,
      },
    }),
    prisma.pronunciationReview.create({
      data: { language: "es", userId, userLanguage: "en", wordId: word.id },
    }),
    prisma.aiCall.create({
      data: {
        contentScope: "shared",
        goalId: exam.goal.id,
        latencyMs: 300,
        model: "openai/gpt-6-sol",
        promptVersion: "v1",
        provider: "openai",
        requestedModel: "openai/gpt-6-sol",
        runId: aiCallRunId,
        task: "course-outline",
        userId,
      },
    }),
  ]);

  return {
    aiCallRunId,
    feedbackIds: [feedback.id, signedOutFeedback.id],
    learner,
    personal: {
      attemptId: attempt.id,
      evaluationRunHash: evaluationRuns.personalHash,
      goalIds: [exam.goal.id],
      mockAttemptId: mockAttempt.id,
      mockId: mock.id,
      privateBlueprintId: privateBlueprint.id,
      privateChapterIds: privateCourse.chapters.map((privateChapter) => privateChapter.id),
      privateCourseId: privateCourse.course.id,
      privateLessonIds: privateCourse.lessons.flat().map((privateLesson) => privateLesson.id),
      privatePicture,
      privateSkillId: privateSkill.id,
      privateUpload,
      threadId: thread.id,
    },
    shared: {
      audio,
      catalog,
      chapter,
      evaluationRunHash: evaluationRuns.sharedHash,
      exam,
      item,
      itemExplanation,
      law,
      lesson,
      mindMap,
      optionPicture,
      picture,
      prerequisite,
      publicUpload,
      quick,
      scenario,
      sharedAnswer,
      skill,
      step,
      stepExplanation,
      variant,
      word,
    },
  };
}

type Built = Awaited<ReturnType<typeof learnerWithSharedContent>>;

async function learnerWithKeptRecords() {
  const [learner, blueprint, skill, lesson] = await Promise.all([
    userFixture(),
    examBlueprintFixture(),
    skillFixture(),
    libraryLessonFixture({ contentStatus: "completed" }),
  ]);

  const userId = learner.id;

  const [goal, item] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId }),
    itemFixture({ examBlueprintId: blueprint.id, skillId: skill.id }),
  ]);

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {},
      examBlueprintId: blueprint.id,
      finishedAt: MOCK_FINISHED_AT,
      goalId: goal.id,
      sectionStartedAt: MOCK_FINISHED_AT,
      status: "finished",
      userId,
    },
  });

  const [feedback] = await Promise.all([
    feedbackFixture({ email: learner.email, message: FEEDBACK, userId }),
    attemptFixture({ answeredAt: MOCK_FINISHED_AT, itemId: item.id, mockExamId: mock.id, userId }),
    learningEventFixture({
      contentIds: { lessonId: lesson.id },
      endedAt: LESSON_ENDED_AT,
      goalId: goal.id,
      seconds: 200,
      titleSnapshot: lesson.title,
      userId,
    }),
    prisma.examResult.create({
      data: {
        estimateHigh: 700,
        estimateLow: 640,
        examBlueprintId: blueprint.id,
        examName: "Test Exam",
        goalId: goal.id,
        reportedAt: RESULT_REPORTED_AT,
        scale: "irt",
        score: 690,
        userId,
      },
    }),
  ]);

  return {
    blueprintId: blueprint.id,
    feedbackId: feedback.id,
    itemId: item.id,
    learner,
    lessonId: lesson.id,
  };
}

function storeFolders(built: Built) {
  const userId = built.learner.id;

  return {
    [`audio/${userId}/`]: [],
    [`images/${userId}/`]: [built.personal.privatePicture.url],
    [`sources/${userId}/`]: [
      built.personal.privateUpload.blobUrl,
      built.shared.publicUpload.blobUrl,
    ],
  } as Record<string, (string | null)[]>;
}

function mockPrivateStore(built: Built) {
  const folders = storeFolders(built);

  vi.mocked(list).mockImplementation(
    async (options) =>
      ({
        blobs: (folders[options?.prefix ?? ""] ?? []).map((url) => ({ url })),
        hasMore: false,
      }) as unknown as Awaited<ReturnType<typeof list>>,
  );
}

async function expectSharedContentKept({ aiCallRunId, shared }: Built) {
  const { catalog, exam, law, quick } = shared;

  await expect(
    Promise.all([
      prisma.course.count({ where: { id: { in: [catalog.course.id, quick.course.id] } } }),
      prisma.chapter.count({ where: { id: shared.chapter.id } }),
      prisma.lesson.count({
        where: { id: { in: [shared.lesson.id, law.lesson.id, quick.lessonId] } },
      }),
      prisma.courseChapter.count({ where: { chapterId: shared.chapter.id } }),
      prisma.chapterLesson.count({ where: { chapterId: shared.chapter.id } }),
      prisma.skill.count({
        where: { id: { in: [shared.skill.id, shared.prerequisite.id, quick.skill.id] } },
      }),
      prisma.skillPrerequisite.count({ where: { skillId: shared.skill.id } }),
      prisma.lessonSkill.count({ where: { lessonId: shared.lesson.id } }),
      prisma.chapterSkill.count({ where: { chapterId: shared.chapter.id } }),
      prisma.step.count({ where: { lessonId: { in: [shared.lesson.id, law.lesson.id] } } }),
      prisma.stepVariant.count({ where: { id: shared.variant.id } }),
      prisma.stepOptionPicture.count({ where: { stepId: shared.step.id } }),
      prisma.tutorSharedAnswer.count({ where: { id: shared.sharedAnswer.id } }),
      prisma.answerExplanation.count({
        where: { id: { in: [shared.itemExplanation.id, shared.stepExplanation.id] } },
      }),
      prisma.item.count({ where: { id: { in: [shared.item.id, exam.pastQuestion.id] } } }),
      prisma.mediaAsset.count({ where: { id: { in: [shared.picture.id, shared.audio.id] } } }),
      prisma.chapterMindMap.count({ where: { id: shared.mindMap.id } }),
      prisma.conversationScenario.count({ where: { id: shared.scenario.id } }),
      prisma.word.count({ where: { id: shared.word.id } }),
      prisma.source.count({
        where: { id: { in: [exam.notice.id, law.law.id, shared.publicUpload.id] } },
      }),
      prisma.examBlueprint.count({ where: { id: exam.blueprint.id } }),
      prisma.sourceChangeNotice.count({ where: { id: exam.changeNotice.id } }),
      prisma.contentReviewFlag.count({ where: { id: exam.reviewFlag.id } }),
      prisma.targetCutoff.count({ where: { id: exam.cutoff.id } }),
      prisma.examSkillGraph.count({ where: { examBlueprintId: exam.blueprint.id } }),
      prisma.examCourseWeights.count({ where: { examBlueprintId: exam.blueprint.id } }),
    ]),
  ).resolves.toStrictEqual([
    2, 1, 3, 1, 2, 3, 1, 1, 1, 2, 1, 1, 1, 2, 2, 2, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1,
  ]);

  await expect(
    prisma.step.findUniqueOrThrow({ where: { id: shared.step.id } }),
  ).resolves.toMatchObject({ mediaAssetId: shared.picture.id, skillId: shared.skill.id });

  await expect(
    prisma.item.findUniqueOrThrow({ where: { id: exam.pastQuestion.id } }),
  ).resolves.toMatchObject({ examBlueprintId: exam.blueprint.id, sourceId: exam.notice.id });

  await expect(
    prisma.evaluationRun.count({ where: { inputHash: shared.evaluationRunHash } }),
  ).resolves.toBe(1);

  await expect(
    prisma.aiCall.findFirstOrThrow({ where: { runId: aiCallRunId } }),
  ).resolves.toMatchObject({ goalId: null, userId: null });
}

async function expectReusableByAnotherLearner({ shared }: Built) {
  const other = await userFixture();

  const goal = await goalFixture({
    examBlueprintId: shared.exam.blueprint.id,
    kind: "exam",
    userId: other.id,
  });

  await planFixture({ goalId: goal.id });
  const inputs = await loadGoalCurriculumInputs(goal.id);

  if (!inputs) {
    throw new Error("The second learner's curriculum inputs couldn't be read.");
  }

  await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toMatchObject({
    idsByKey: { [shared.skill.id]: shared.skill.id },
    primaryCourseId: null,
  });

  await expect(
    copyStoredCourseWeights({
      goalId: goal.id,
      lookup: { ...COURSE_WEIGHTS_TARGET, examBlueprintId: shared.exam.blueprint.id },
    }),
  ).resolves.toBe(true);

  await expect(findExplanationGoFurther(shared.quick.lessonId)).resolves.toStrictEqual({
    courseId: shared.quick.course.id,
    relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
  });

  const spec = await loadLessonSpecInputs(shared.law.lesson.id);

  expect(spec?.prompt.sources).toContain(
    "A posse do servidor público ocorre no prazo de trinta dias",
  );
}

async function expectPersonalDataGone({ learner, personal }: Built) {
  await expect(
    Promise.all([
      prisma.user.count({ where: { id: learner.id } }),
      prisma.goal.count({ where: { userId: learner.id } }),
      prisma.plan.count({ where: { goalId: { in: personal.goalIds } } }),
      prisma.attempt.count({ where: { id: personal.attemptId } }),
      prisma.mistake.count({ where: { userId: learner.id } }),
      prisma.learnerSkill.count({ where: { userId: learner.id } }),
      prisma.studySession.count({ where: { userId: learner.id } }),
      prisma.stepExampleLine.count({ where: { userId: learner.id } }),
      prisma.lessonQuestionThread.count({ where: { id: personal.threadId } }),
      prisma.memoryFact.count({ where: { userId: learner.id } }),
      prisma.mockExam.count({ where: { id: personal.mockId } }),
      prisma.examResult.count({ where: { userId: learner.id } }),
      prisma.learnerSource.count({ where: { userId: learner.id } }),
      prisma.pronunciationReview.count({ where: { userId: learner.id } }),
      prisma.course.count({ where: { id: personal.privateCourseId } }),
      prisma.chapter.count({ where: { id: { in: personal.privateChapterIds } } }),
      prisma.lesson.count({ where: { id: { in: personal.privateLessonIds } } }),
      prisma.skill.count({ where: { id: personal.privateSkillId } }),
      prisma.item.count({ where: { skillId: personal.privateSkillId } }),
      prisma.mediaAsset.count({ where: { id: personal.privatePicture.id } }),
      prisma.source.count({ where: { id: personal.privateUpload.id } }),
      prisma.examBlueprint.count({ where: { id: personal.privateBlueprintId } }),
      prisma.evaluationRun.count({ where: { inputHash: personal.evaluationRunHash } }),
      prisma.goalUnderstanding.count({ where: { userId: learner.id } }),
    ]),
  ).resolves.toStrictEqual(Array.from({ length: 24 }, () => 0));
}

async function expectAnonymousRecordsKept({ feedbackIds, learner, personal, shared }: Built) {
  const { blueprint, goal, pastQuestion } = shared.exam;
  const omit = { id: true } as const;

  const [firstAnswers, mockAnswers, paces, results] = await Promise.all([
    prisma.anonymousFirstAnswer.findMany({
      omit,
      where: { itemId: { in: [shared.item.id, pastQuestion.id] } },
    }),
    prisma.anonymousMockAnswer.findMany({ where: { examBlueprintId: blueprint.id } }),
    prisma.anonymousLessonPace.findMany({ omit, where: { lessonId: shared.lesson.id } }),
    prisma.anonymousExamResult.findMany({ omit, where: { examBlueprintId: blueprint.id } }),
  ]);

  expect(
    firstAnswers.toSorted((first, second) => first.itemId.localeCompare(second.itemId)),
  ).toStrictEqual(
    [
      { isCorrect: false, itemId: shared.item.id },
      { isCorrect: false, itemId: pastQuestion.id },
    ].toSorted((first, second) => first.itemId.localeCompare(second.itemId)),
  );

  expect(mockAnswers).toStrictEqual([
    {
      durationMs: 95_000,
      examBlueprintId: blueprint.id,
      finishedOn: new Date("2026-09-20T00:00:00Z"),
      id: expect.any(String),
      learnerKey: expect.any(String),
      mockKey: expect.any(String),
    },
  ]);

  expect(paces).toStrictEqual([
    { lessonId: shared.lesson.id, localDate: new Date("2026-09-21T00:00:00Z"), seconds: 200 },
  ]);

  expect(results).toStrictEqual([
    {
      estimateHigh: 700,
      estimateLow: 640,
      examBlueprintId: blueprint.id,
      maxScore: null,
      reportedOn: new Date("2026-11-10T00:00:00Z"),
      scale: "irt",
      score: 690,
    },
  ]);

  const kept = JSON.stringify([firstAnswers, mockAnswers, paces, results]);

  for (const id of [
    learner.id,
    goal.id,
    personal.mockId,
    personal.attemptId,
    personal.mockAttemptId,
  ]) {
    expect(kept).not.toContain(id);
  }

  expect(mockAnswers[0]?.id.charAt(14)).toBe("4");

  await expect(
    prisma.feedback.findMany({
      select: { email: true, message: true, userId: true },
      where: { id: { in: feedbackIds } },
    }),
  ).resolves.toStrictEqual([
    { email: null, message: FEEDBACK, userId: null },
    { email: null, message: FEEDBACK, userId: null },
  ]);
}

function listDeletedFiles(): string[] {
  return vi
    .mocked(del)
    .mock.calls.flatMap(([urls]) => (Array.isArray(urls) ? urls : [urls]))
    .toSorted((first, second) => first.localeCompare(second));
}

describe("deleting a learner", () => {
  beforeEach(() => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "test-private-store-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps every shared thing their study made and removes everything personal when the learner deletes their account (DELETE /v1/me)", async () => {
    const built = await learnerWithSharedContent();
    mockPrivateStore(built);

    await deleteOwnAccount(built.learner);

    await expectPersonalDataGone(built);
    await expectSharedContentKept(built);
    await expectAnonymousRecordsKept(built);

    expect(listDeletedFiles()).toStrictEqual(
      [built.personal.privatePicture.url, built.personal.privateUpload.blobUrl].toSorted(
        (first, second) => (first ?? "").localeCompare(second ?? ""),
      ),
    );

    await expectReusableByAnotherLearner(built);
  });

  it("counts the learner once in what everyone keeps when their deletion is retried", async () => {
    const { blueprintId, feedbackId, itemId, learner, lessonId } = await learnerWithKeptRecords();
    vi.mocked(list).mockResolvedValue({ blobs: [], hasMore: false } as never);

    await deleteUserDependenciesBeforeAuthDelete(learner);
    await deleteOwnAccount(learner);

    await expect(
      Promise.all([
        prisma.user.count({ where: { id: learner.id } }),
        prisma.anonymousFirstAnswer.count({ where: { itemId } }),
        prisma.anonymousMockAnswer.count({ where: { examBlueprintId: blueprintId } }),
        prisma.anonymousLessonPace.count({ where: { lessonId } }),
        prisma.anonymousExamResult.count({ where: { examBlueprintId: blueprintId } }),
        prisma.feedback.count({ where: { email: null, id: feedbackId, userId: null } }),
      ]),
    ).resolves.toStrictEqual([0, 1, 1, 1, 1, 1]);
  });
});
