import { type APIRequestContext, type request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { z } from "zod";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { createLanguageChallenge } from "./language-challenge-fixtures";

/** Let every owned fixture task finish before a failure triggers client/database cleanup. */
export async function drainParallel<const Values extends readonly unknown[]>(values: Values) {
  await Promise.allSettled(values);
  return Promise.all(values);
}

async function assertAuthenticatedActor(actor: { client: APIRequestContext; id: string }) {
  const response = await actor.client.get("/api/auth/get-session");

  const authenticated = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await response.json());

  if (!response.ok() || authenticated.user.id !== actor.id) {
    throw new Error("Prerender learner authentication did not reach its fixture identity.");
  }
}

export async function createPrerenderCrawlFixtures({
  baseURL,
  createContext,
}: {
  baseURL: string;
  createContext: (
    storageState?: NonNullable<Parameters<typeof request.newContext>[0]>["storageState"],
  ) => Promise<APIRequestContext>;
}) {
  const [exam, language, explanation, challenge, written] = await drainParallel([
    createE2EPersona(baseURL, { persona: "exam" }),
    createE2EPersona(baseURL, { persona: "language" }),
    createE2EPersona(baseURL, { persona: "explain" }),
    createLanguageChallenge({ final: false, plus: true }),
    createAnytimeMockLearner({ plus: true, written: true }),
  ]);

  const [plan, conversation, pattern, essayItem, objectiveItem] = await drainParallel([
    prisma.plan.findUniqueOrThrow({ where: { goalId: exam.goalId } }),
    prisma.languageConversation.findFirstOrThrow({ where: { userId: language.id } }),
    prisma.mistakePattern.findFirstOrThrow({ where: { userId: language.id } }),
    prisma.item.findFirstOrThrow({
      where: { examBlueprintId: written.goal.examBlueprintId, format: "essay" },
    }),
    prisma.item.findFirstOrThrow({
      where: { examBlueprintId: written.goal.examBlueprintId, format: "multipleChoice" },
    }),
  ]);

  const item = await prisma.planItem.findFirstOrThrow({
    where: { lessonId: { not: null }, planId: plan.id },
  });

  if (!item.lessonId) {
    throw new Error("Prerender lesson fixture is missing.");
  }

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: item.lessonId } });

  if (!lesson.homeChapterId) {
    throw new Error("Prerender lesson has no home chapter.");
  }

  const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: lesson.homeChapterId } });

  if (!chapter.homeCourseId) {
    throw new Error("Prerender chapter has no home course.");
  }

  const course = await prisma.course.findUniqueOrThrow({
    include: { organization: true },
    where: { id: chapter.homeCourseId },
  });

  if (!course.organization) {
    throw new Error("Prerender catalog fixture has no brand.");
  }

  const session = await studySessionFixture({ goalId: written.goal.id, userId: written.user.id });

  const [essay, mock] = await drainParallel([
    studySessionBlockFixture({
      kind: "produce",
      payload: { itemIds: [essayItem.id] },
      sessionId: session.id,
    }),
    prisma.mockExam.create({
      data: {
        conditions: {
          day: null,
          fullLength: false,
          purpose: "practice",
          scoring: "raw",
          sections: [
            {
              essays: [],
              itemIds: [objectiveItem.id],
              minutes: 180,
              name: "Objective test",
              questions: 1,
              routing: null,
            },
          ],
          shape: { area: null, day: null, kind: "full" },
          startTime: null,
          timeZone: null,
        },
        examBlueprintId: written.goal.examBlueprintId,
        goalId: written.goal.id,
        sectionStartedAt: new Date(),
        userId: written.user.id,
      },
    }),
  ]);

  const [
    visitor,
    examContext,
    languageContext,
    explanationContext,
    challengeContext,
    writtenContext,
  ] = await drainParallel([
    createContext(),
    createContext(exam.storageState),
    createContext(language.storageState),
    createContext(explanation.storageState),
    createContext(challenge.user.storageState),
    createContext(written.user.storageState),
  ]);

  const actors = [
    { client: examContext, id: exam.id },
    { client: languageContext, id: language.id },
    { client: explanationContext, id: explanation.id },
    { client: challengeContext, id: challenge.user.id },
    { client: writtenContext, id: written.user.id },
  ];

  await drainParallel(actors.map((actor) => assertAuthenticatedActor(actor)));

  const syllabusResponse = await examContext.get(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/goals/${exam.goalId}/syllabus`,
  );

  if (!syllabusResponse.ok()) {
    throw new Error(`Prerender syllabus fixture lookup failed (${syllabusResponse.status()}).`);
  }

  const syllabus = z
    .object({ subjects: z.array(z.object({ key: z.string() })).min(1) })
    .parse(await syllabusResponse.json());

  const subject = syllabus.subjects[0];

  if (!subject) {
    throw new Error("Prerender syllabus fixture has no subject.");
  }

  const parameters: Record<string, string> = {
    brandSlug: course.organization.slug,
    category: "math",
    chapterId: chapter.id,
    chapterSlug: chapter.slug,
    courseId: course.id,
    courseSlug: course.slug,
    currency: "brl",
    goalId: exam.goalId,
    /** A non-default locale avoids transport-only canonical prefix redirects during the page crawl. */
    lang: "pt",
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    planId: plan.id,
    subject: subject.key,
  };

  return {
    examContext,
    parameters,
    special: {
      challenge: { client: challengeContext, params: { planItemId: challenge.boss.id } },
      checkpoint: { client: challengeContext, params: { blockId: challenge.block.id } },
      conversation: { client: languageContext, params: { conversationId: conversation.id } },
      essay: { client: writtenContext, params: { blockId: essay.id } },
      explain: { client: explanationContext, params: { goalId: explanation.goalId } },
      mock: { client: writtenContext, params: { blockId: mock.id } },
      pattern: { client: languageContext, params: { patternId: pattern.id } },
    },
    visitor,
  };
}
