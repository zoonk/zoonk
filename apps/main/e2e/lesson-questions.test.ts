import { randomUUID } from "node:crypto";
import { type Locator, type Page, type Route } from "@playwright/test";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { advanceToCompletionSummary } from "./completion";
import { expect, test } from "./fixtures";

const ANSWER_TEXT = "Gravity keeps pulling while the satellite moves forward, bending its path.";

const UI_MESSAGE_STREAM_HEADERS = {
  "Cache-Control": "no-cache",
  "Content-Type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

function uiMessageEvent(event: object) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function uiMessageStreamBody(chunks: string[]) {
  return [
    uiMessageEvent({ type: "start" }),
    uiMessageEvent({ id: "answer", type: "text-start" }),
    ...chunks.map((delta) => uiMessageEvent({ delta, id: "answer", type: "text-delta" })),
    uiMessageEvent({ id: "answer", type: "text-end" }),
    uiMessageEvent({ type: "finish" }),
    "data: [DONE]\n\n",
  ].join("");
}

async function getRequiredElementBox(locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Expected a visible element bounding box");
  }

  return box;
}

function questionResource({
  answer = null,
  context,
  question,
  status,
}: {
  answer?: string | null;
  context: LessonQuestionContextSummary;
  question: string;
  status: LessonQuestionResource["status"];
}): LessonQuestionResource {
  const now = new Date().toISOString();

  return { answer, context, createdAt: now, id: randomUUID(), question, status, updatedAt: now };
}

type QuestionLessonScenario = {
  correctOption: string;
  correctOptionId: string;
  hiddenFeedback: string;
  lessonId: string;
  question: string;
  stepIds: string[];
  stepTitles: string[];
  url: string;
  wrongOption: string;
  wrongOptionId: string;
};

async function createQuestionLesson({
  includeSecondStep = false,
  staticOnly = false,
}: { includeSecondStep?: boolean; staticOnly?: boolean } = {}): Promise<QuestionLessonScenario> {
  const organization = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Questions Course ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: organization.id,
    slug: `e2e-questions-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
    position: 0,
    slug: `e2e-questions-chapter-${uniqueId}`,
    title: `Orbital motion ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `Learn why falling can create an orbit ${uniqueId}.`,
    isPublished: true,
    kind: staticOnly ? "explanation" : "quiz",
    organizationId: organization.id,
    slug: `e2e-questions-lesson-${uniqueId}`,
    title: `Staying in orbit ${uniqueId}`,
  });

  const question = `Why does a satellite stay in orbit ${uniqueId}?`;
  const correctOption = `Gravity bends its path ${uniqueId}`;
  const correctOptionId = `right-${uniqueId}`;
  const wrongOption = `There is no gravity ${uniqueId}`;
  const wrongOptionId = `wrong-${uniqueId}`;
  const hiddenFeedback = `Hidden correction ${uniqueId}`;
  const firstStepTitle = `Orbit concept ${uniqueId}`;

  const firstStep = await stepFixture({
    content: staticOnly
      ? { text: question, title: firstStepTitle, variant: "text" }
      : {
          options: [
            {
              feedback: `Correct feedback ${uniqueId}`,
              id: correctOptionId,
              isCorrect: true,
              text: correctOption,
            },
            { feedback: hiddenFeedback, id: wrongOptionId, isCorrect: false, text: wrongOption },
          ],
          question,
        },
    isPublished: true,
    kind: staticOnly ? "static" : "multipleChoice",
    lessonId: lesson.id,
    position: 0,
  });

  if (!includeSecondStep) {
    return {
      correctOption,
      correctOptionId,
      hiddenFeedback,
      lessonId: lesson.id,
      question,
      stepIds: [firstStep.id],
      stepTitles: [firstStepTitle],
      url: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
      wrongOption,
      wrongOptionId,
    };
  }

  const secondStepTitle = `A second perspective ${uniqueId}`;

  const secondStep = await stepFixture({
    content: {
      text: `An orbit is continuous free fall ${uniqueId}.`,
      title: secondStepTitle,
      variant: "text",
    },
    isPublished: true,
    kind: "static",
    lessonId: lesson.id,
    position: 1,
  });

  return {
    correctOption,
    correctOptionId,
    hiddenFeedback,
    lessonId: lesson.id,
    question,
    stepIds: [firstStep.id, secondStep.id],
    stepTitles: [firstStepTitle, secondStepTitle],
    url: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    wrongOption,
    wrongOptionId,
  };
}

function getContextSummary(
  context: CreateLessonQuestionInput["context"],
): LessonQuestionContextSummary {
  if (context.kind === "lesson") {
    return { kind: "lesson" };
  }

  return { kind: context.kind, stepId: context.stepId, stepNumber: context.stepNumber };
}

function expectBearerAuthorization(route: Route) {
  expect(route.request().headers().authorization).toMatch(/^Bearer .+/u);
}

function getMockQuestionPage({
  cursor,
  pageSize,
  questions,
}: {
  cursor: string | null;
  pageSize: number | undefined;
  questions: LessonQuestionResource[];
}) {
  const cursorIndex = cursor ? questions.findIndex((question) => question.id === cursor) : -1;
  const pageEnd = cursorIndex >= 0 ? cursorIndex : questions.length;
  const pageStart = pageSize ? Math.max(0, pageEnd - pageSize) : 0;
  const page = questions.slice(pageStart, pageEnd);
  const hasMore = pageStart > 0;

  return { hasMore, nextCursor: hasMore ? (page[0]?.id ?? null) : null, questions: page };
}

async function mockQuestionApi({
  answerLimitRequestNumbers = [],
  completeQuestionBeforeReplay = false,
  completeRunningAfterStatusRequest,
  createErrorStatus,
  failAnswerRequestNumbers = [],
  failGetRequestNumbers = [],
  failStatusRequestNumbers = [],
  holdGetRequestNumbers = [],
  holdFirstCreateResponse = false,
  initialQuestions = [],
  lessonId,
  loseFirstCreateResponseAfterPersist = false,
  page,
  remoteQuestionOnFirstCreateConflict,
  statusErrorStatuses = {},
  threadPageSize,
}: {
  answerLimitRequestNumbers?: number[];
  completeQuestionBeforeReplay?: boolean;
  completeRunningAfterStatusRequest?: number;
  createErrorStatus?: number;
  failAnswerRequestNumbers?: number[];
  failGetRequestNumbers?: number[];
  failStatusRequestNumbers?: number[];
  holdGetRequestNumbers?: number[];
  holdFirstCreateResponse?: boolean;
  initialQuestions?: LessonQuestionResource[];
  lessonId: string;
  loseFirstCreateResponseAfterPersist?: boolean;
  page: Page;
  remoteQuestionOnFirstCreateConflict?: LessonQuestionResource;
  statusErrorStatuses?: Partial<Record<number, number>>;
  threadPageSize?: number;
}) {
  const threadId = randomUUID();
  const firstCreateResponse = Promise.withResolvers<null>();

  const heldGetResponses = new Map(
    holdGetRequestNumbers.map(
      (requestNumber) => [requestNumber, Promise.withResolvers<null>()] as const,
    ),
  );

  const questionsByRequestId = new Map<
    string,
    { input: CreateLessonQuestionInput; question: LessonQuestionResource }
  >();

  const state: {
    answerRequests: number;
    completedGetRequests: number;
    getRequests: number;
    inputs: CreateLessonQuestionInput[];
    questions: LessonQuestionResource[];
    releaseFirstCreateResponse: () => void;
    releaseGetResponse: (requestNumber: number) => void;
    statusRequests: number;
  } = {
    answerRequests: 0,
    completedGetRequests: 0,
    getRequests: 0,
    inputs: [],
    questions: initialQuestions,
    releaseFirstCreateResponse: () => firstCreateResponse.resolve(null),
    releaseGetResponse: (requestNumber) => heldGetResponses.get(requestNumber)?.resolve(null),
    statusRequests: 0,
  };

  await page.route("**/v1/lessons/**/questions*", async (route) => {
    expectBearerAuthorization(route);

    if (route.request().method() === "GET") {
      state.getRequests += 1;

      if (failGetRequestNumbers.includes(state.getRequests)) {
        await route.fulfill({
          contentType: "application/json",
          json: { error: "Unavailable" },
          status: 503,
        });

        return;
      }

      const cursor = new URL(route.request().url()).searchParams.get("cursor");

      const threadPage = getMockQuestionPage({
        cursor,
        pageSize: threadPageSize,
        questions: state.questions,
      });

      const responseJson =
        state.questions.length === 0 ? null : { id: threadId, lessonId, ...threadPage };

      const heldResponse = heldGetResponses.get(state.getRequests);

      if (heldResponse) {
        await heldResponse.promise;
      }

      await route.fulfill({ contentType: "application/json", json: responseJson, status: 200 });
      state.completedGetRequests += 1;

      return;
    }

    const input = createLessonQuestionInputSchema.parse(route.request().postDataJSON());
    state.inputs = [...state.inputs, input];

    if (remoteQuestionOnFirstCreateConflict && state.inputs.length === 1) {
      state.questions = [...state.questions, remoteQuestionOnFirstCreateConflict];

      await route.fulfill({
        contentType: "application/json",
        json: { error: "An unfinished question already exists" },
        status: 409,
      });

      return;
    }

    if (createErrorStatus) {
      await route.fulfill({
        contentType: "application/json",
        json: { error: "Question unavailable" },
        status: createErrorStatus,
      });

      return;
    }

    const existingRequest = questionsByRequestId.get(input.requestId);

    if (existingRequest) {
      const isSameRequest = JSON.stringify(existingRequest.input) === JSON.stringify(input);

      const currentQuestion =
        state.questions.find((question) => question.id === existingRequest.question.id) ??
        existingRequest.question;

      const replayedQuestion = completeQuestionBeforeReplay
        ? { ...currentQuestion, answer: ANSWER_TEXT, status: "completed" as const }
        : currentQuestion;

      if (completeQuestionBeforeReplay) {
        questionsByRequestId.set(input.requestId, { input, question: replayedQuestion });

        state.questions = state.questions.map((question) =>
          question.id === replayedQuestion.id ? replayedQuestion : question,
        );
      }

      await route.fulfill({
        contentType: "application/json",
        json: isSameRequest ? replayedQuestion : { error: "Conflict" },
        status: isSameRequest ? 201 : 409,
      });

      return;
    }

    const now = new Date().toISOString();

    const question: LessonQuestionResource = {
      answer: null,
      context: getContextSummary(input.context),
      createdAt: now,
      id: randomUUID(),
      question: input.question,
      status: "pending",
      updatedAt: now,
    };

    questionsByRequestId.set(input.requestId, { input, question });
    state.questions = [...state.questions, question];

    if (loseFirstCreateResponseAfterPersist && state.inputs.length === 1) {
      if (holdFirstCreateResponse) {
        await firstCreateResponse.promise;
      }

      await route.abort("connectionreset");
      return;
    }

    await route.fulfill({ contentType: "application/json", json: question, status: 201 });
  });

  await page.route("**/v1/questions/*", async (route) => {
    expectBearerAuthorization(route);
    const questionId = new URL(route.request().url()).pathname.split("/").at(-1);

    state.statusRequests += 1;
    const errorStatus = statusErrorStatuses[state.statusRequests];

    if (errorStatus) {
      await route.fulfill({
        contentType: "application/json",
        json: { error: "Question unavailable" },
        status: errorStatus,
      });

      return;
    }

    if (failStatusRequestNumbers.includes(state.statusRequests)) {
      await route.fulfill({
        contentType: "application/json",
        json: { error: "Unavailable" },
        status: 503,
      });

      return;
    }

    if (
      completeRunningAfterStatusRequest &&
      state.statusRequests >= completeRunningAfterStatusRequest
    ) {
      state.questions = state.questions.map((question) =>
        question.id === questionId && question.status === "running"
          ? { ...question, answer: ANSWER_TEXT, status: "completed" }
          : question,
      );
    }

    const question = state.questions.find((candidate) => candidate.id === questionId);

    await route.fulfill(
      question
        ? { contentType: "application/json", json: question, status: 200 }
        : { contentType: "application/json", json: { error: "Not found" }, status: 404 },
    );
  });

  await page.route("**/v1/questions/**/answers", async (route) => {
    expectBearerAuthorization(route);
    state.answerRequests += 1;
    const questionId = new URL(route.request().url()).pathname.split("/").at(-2);

    if (failAnswerRequestNumbers.includes(state.answerRequests)) {
      await route.fulfill({
        contentType: "application/json",
        json: { error: "Answer unavailable" },
        status: 503,
      });

      return;
    }

    if (answerLimitRequestNumbers.includes(state.answerRequests)) {
      state.questions = state.questions.map((question) =>
        question.id === questionId ? { ...question, status: "failed" } : question,
      );

      await route.fulfill({
        contentType: "application/json",
        json: {
          error: {
            code: "GENERATION_LIMIT_REACHED",
            details: { period: "day", resource: "lessonQuestion", viewer: "subscriber" },
            message: "Generation limit reached",
          },
        },
        status: 429,
      });

      return;
    }

    state.questions = state.questions.map((question) =>
      question.id === questionId
        ? { ...question, answer: ANSWER_TEXT, status: "completed" }
        : question,
    );

    await route.fulfill({
      body: uiMessageStreamBody([ANSWER_TEXT]),
      headers: UI_MESSAGE_STREAM_HEADERS,
      status: 200,
    });
  });

  return state;
}

async function installStreamingAnswerResponse({
  chunks,
  delayMilliseconds,
  maxStreamedAnswers = Number.MAX_SAFE_INTEGER,
  page,
  releaseAfterFirstChunkEvent = null,
}: {
  chunks: string[];
  delayMilliseconds: number;
  maxStreamedAnswers?: number;
  page: Page;
  releaseAfterFirstChunkEvent?: string | null;
}) {
  await page.addInitScript(
    ({ answerChunks, chunkDelay, releaseEvent, streamLimit }) => {
      const originalFetch = globalThis.fetch.bind(globalThis);
      let streamedAnswerCount = 0;

      globalThis.fetch = (input, init) => {
        const url =
          typeof input === "string" || input instanceof URL ? input.toString() : input.url;

        if (
          !url.includes("/v1/questions/") ||
          !url.endsWith("/answers") ||
          streamedAnswerCount >= streamLimit
        ) {
          return originalFetch(input, init);
        }

        streamedAnswerCount += 1;
        const encoder = new TextEncoder();

        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                function encodeEvent(event: object) {
                  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
                }

                controller.enqueue(encodeEvent({ type: "start" }));
                controller.enqueue(encodeEvent({ id: "answer", type: "text-start" }));

                function enqueueChunk(index: number) {
                  const chunk = answerChunks[index];

                  if (chunk === undefined) {
                    controller.enqueue(encodeEvent({ id: "answer", type: "text-end" }));
                    controller.enqueue(encodeEvent({ type: "finish" }));
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                    return;
                  }

                  controller.enqueue(
                    encodeEvent({ delta: chunk, id: "answer", type: "text-delta" }),
                  );

                  if (index === 0 && releaseEvent) {
                    globalThis.addEventListener(releaseEvent, () => enqueueChunk(index + 1), {
                      once: true,
                    });

                    return;
                  }

                  setTimeout(() => enqueueChunk(index + 1), chunkDelay);
                }

                enqueueChunk(0);
              },
            }),
            {
              headers: {
                "Cache-Control": "no-cache",
                "Content-Type": "text/event-stream",
                "x-vercel-ai-ui-message-stream": "v1",
              },
              status: 200,
            },
          ),
        );
      };
    },
    {
      answerChunks: chunks,
      chunkDelay: delayMilliseconds,
      releaseEvent: releaseAfterFirstChunkEvent,
      streamLimit: maxStreamedAnswers,
    },
  );
}

async function expectCreateRecoveryAction({
  action,
  page,
  status,
}: {
  action: string;
  page: Page;
  status: number;
}) {
  const scenario = await createQuestionLesson();

  const api = await mockQuestionApi({
    createErrorStatus: status,
    lessonId: scenario.lessonId,
    page,
  });

  await page.goto(scenario.url);
  await page.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Can I ask this?");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("link", { name: action })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Ask a question" }).press("Enter");
  expect(api.inputs).toHaveLength(1);
}

test("asks from the active step, copies safe context, follows up, and resumes", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson({ includeSecondStep: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.goto(scenario.url);
  await expect(authenticatedPage.getByText(scenario.question)).toBeVisible();
  const lessonUrl = authenticatedPage.url();

  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();

  const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
  await expect(textbox).toHaveAttribute("placeholder", "Ask about the lesson content…");
  const firstQuestion = `Can you explain this orbit ${randomUUID().slice(0, 6)}?`;
  await textbox.fill(firstQuestion);

  await authenticatedPage
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(authenticatedPage.url()).origin,
    });

  await dialog.getByRole("button", { name: "Copy lesson content" }).click();
  await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
  await authenticatedPage.keyboard.press("2");
  const copied = await authenticatedPage.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(scenario.question);
  expect(copied).toContain(scenario.correctOption);
  expect(copied).toContain(scenario.wrongOption);
  expect(copied).toContain(firstQuestion);
  expect(copied).toContain("Currently viewing: Part 1 of 2");
  expect(copied).toContain(scenario.stepTitles[1]);
  expect(copied).not.toContain(scenario.hiddenFeedback);
  expect(copied).not.toContain(scenario.stepIds[0]);

  await textbox.press("Enter");
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();

  expect(api.inputs[0]).toMatchObject({
    context: { kind: "step", stepId: scenario.stepIds[0], stepNumber: 1 },
    question: firstQuestion,
  });

  await authenticatedPage.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(authenticatedPage.url()).toBe(lessonUrl);
  await expect(authenticatedPage.getByText(scenario.question)).toBeVisible();

  await expect(
    authenticatedPage.getByRole("radio", { name: scenario.wrongOption }),
  ).not.toBeChecked();

  await authenticatedPage.getByRole("radio", { name: scenario.correctOption }).click();
  await authenticatedPage.getByRole("button", { name: /check/iu }).click();
  await authenticatedPage.getByRole("button", { name: /continue/iu }).click();
  const secondStepTitle = scenario.stepTitles[1];

  if (!secondStepTitle) {
    throw new Error("Question follow-up scenario is missing its second step");
  }

  await expect(authenticatedPage.getByText(secondStepTitle)).toBeVisible();
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect(dialog.getByText(firstQuestion)).toBeVisible();

  const followUp = "How does that connect to free fall?";
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill(followUp);
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(followUp)).toBeVisible();
  await expect.poll(() => api.inputs.length).toBe(2);

  expect(api.inputs[1]).toMatchObject({
    context: { kind: "step", stepId: scenario.stepIds[1], stepNumber: 2 },
    question: followUp,
  });

  await authenticatedPage.keyboard.press("Escape");
  await authenticatedPage.reload();
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect(dialog.getByText(firstQuestion)).toBeVisible();
  await expect(dialog.getByText(followUp)).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(2);
});

test("renders streamed answers as markdown", async ({ subscriberPage: authenticatedPage }) => {
  const scenario = await createQuestionLesson();
  const releaseStreamEvent = "release-markdown-answer";

  await installStreamingAnswerResponse({
    chunks: [
      "### Key idea\n\n",
      "- **Gravity** bends the path.\n",
      "- [Velocity](https://example.com) carries it forward.",
    ],
    delayMilliseconds: 40,
    page: authenticatedPage,
    releaseAfterFirstChunkEvent: releaseStreamEvent,
  });

  await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Explain the orbit.");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByRole("heading", { level: 3, name: "Key idea" })).toBeVisible();
  await expect(dialog.getByLabel("Answering")).toHaveCount(0);

  await authenticatedPage.evaluate(
    (eventName) => globalThis.dispatchEvent(new Event(eventName)),
    releaseStreamEvent,
  );

  await expect(dialog.getByRole("listitem")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: "Velocity" })).toBeVisible();
});

test("confirms external links in a localized accessible dialog", async ({
  subscriberPage: authenticatedPage,
}) => {
  await setLocale(authenticatedPage, "pt");
  const scenario = await createQuestionLesson();

  await installStreamingAnswerResponse({
    chunks: ["Veja [Exemplo externo](https://example.com) para saber mais."],
    delayMilliseconds: 0,
    page: authenticatedPage,
  });

  await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.goto(scenario.url);

  await authenticatedPage.getByRole("button", { name: "Pergunte sobre esta aula" }).click();

  const questionSheet = authenticatedPage.getByRole("dialog");

  await questionSheet
    .getByRole("textbox", { name: "Faça uma pergunta" })
    .fill("Explique com uma fonte externa.");

  await questionSheet.getByRole("button", { name: "Enviar" }).click();

  const linkTrigger = questionSheet.getByRole("button", { name: "Exemplo externo" });
  await expect(linkTrigger).toBeVisible();
  await linkTrigger.click();

  const confirmation = authenticatedPage.getByRole("alertdialog", { name: "Abrir este link?" });

  const cancel = confirmation.getByRole("button", { name: "Cancelar" });
  const openLink = confirmation.getByRole("link", { name: "Abrir link" });
  await expect(cancel).toBeFocused();
  await authenticatedPage.keyboard.press("Tab");
  await expect(openLink).toBeFocused();
  await authenticatedPage.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await authenticatedPage.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(linkTrigger).toBeFocused();
});

test("does not request images embedded in generated markdown", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();
  const imageUrl = "https://tracking.example.test/pixel.png";
  const requestedImages: string[] = [];

  await authenticatedPage.route(imageUrl, async (route) => {
    requestedImages.push(route.request().url());
    await route.fulfill({ body: "", contentType: "image/png", status: 200 });
  });

  await installStreamingAnswerResponse({
    chunks: [`### Safe answer\n\n![Tracking pixel](${imageUrl})`],
    delayMilliseconds: 0,
    page: authenticatedPage,
  });

  await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Show a safe answer.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByRole("heading", { level: 3, name: "Safe answer" })).toBeVisible();
  await expect(dialog.getByLabel("Answering")).toHaveCount(0);
  expect(requestedImages).toHaveLength(0);
});

test("recovers a lost create before sending a follow-up typed while waiting", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const api = await mockQuestionApi({
    holdFirstCreateResponse: true,
    lessonId: scenario.lessonId,
    loseFirstCreateResponseAfterPersist: true,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
  const question = "Can you explain the orbit again?";
  const followUp = "How does that connect to free fall?";

  await textbox.fill(question);
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => api.questions.length).toBe(1);
  await textbox.fill(followUp);
  api.releaseFirstCreateResponse();

  await expect(dialog.getByRole("alert")).toContainText("We couldn't send your last question");

  await expect(textbox).toHaveValue(followUp);
  await expect(dialog.getByRole("button", { name: "Retry last question" })).toBeVisible();
  expect(api.questions).toHaveLength(1);

  await dialog.getByRole("button", { name: "Retry last question" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await expect(textbox).toHaveValue(followUp);
  expect(api.inputs).toHaveLength(2);
  expect(api.inputs[1]?.requestId).toBe(api.inputs[0]?.requestId);
  expect(api.questions).toHaveLength(1);
  expect(api.answerRequests).toBe(1);

  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(2);
  expect(api.inputs).toHaveLength(3);
  expect(api.inputs[2]?.requestId).not.toBe(api.inputs[0]?.requestId);
  expect(api.questions).toHaveLength(2);
});

test("preserves an answer completed elsewhere while replaying a lost create", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const api = await mockQuestionApi({
    completeQuestionBeforeReplay: true,
    lessonId: scenario.lessonId,
    loseFirstCreateResponseAfterPersist: true,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Explain this replay.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByRole("button", { name: "Retry last question" })).toBeVisible();

  await dialog.getByRole("button", { name: "Retry last question" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.questions).toHaveLength(1);
  expect(api.answerRequests).toBe(0);
});

test("offers sign-in after an authenticated create request loses its session", async ({
  subscriberPage: authenticatedPage,
}) => {
  await expectCreateRecoveryAction({ action: "Sign in", page: authenticatedPage, status: 401 });
});

test("offers plan selection when question access is no longer available", async ({
  subscriberPage: authenticatedPage,
}) => {
  await expectCreateRecoveryAction({ action: "View plans", page: authenticatedPage, status: 402 });
});

test("shows a stable support action when the daily question limit is reached", async ({
  subscriberPage: authenticatedPage,
}) => {
  await authenticatedPage.clock.install({ time: new Date("2026-08-21T23:59:50.000Z") });
  const scenario = await createQuestionLesson();

  const api = await mockQuestionApi({
    answerLimitRequestNumbers: [1],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await dialog
    .getByRole("textbox", { name: "Ask a question" })
    .fill("Explain this within my limit.");

  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByText(/today's question limit/iu)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Contact support" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(api.answerRequests).toBe(1);

  await authenticatedPage.keyboard.press("Escape");
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect(dialog.getByText(/today's question limit/iu)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(0);

  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("A question for tomorrow.");
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  await authenticatedPage.clock.fastForward(11_000);
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
});

test("reconciles a remote unfinished turn after question creation conflicts", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const remoteQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "A question started in another client.",
    status: "pending",
  });

  const api = await mockQuestionApi({
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    remoteQuestionOnFirstCreateConflict: remoteQuestion,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
  await textbox.fill("A local question waiting its turn.");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByText(remoteQuestion.question)).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await expect(textbox).toHaveValue("A local question waiting its turn.");
  expect(api.inputs).toHaveLength(1);
  expect(api.answerRequests).toBe(1);
});

test("resumes a question persisted before its answer request started", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const pendingQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please resume this pending question.",
    status: "pending",
  });

  const api = await mockQuestionApi({
    initialQuestions: [pendingQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await expect(dialog.getByText(pendingQuestion.question)).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.answerRequests).toBe(1);
});

test("resumes a pending question again after transient recovery failures", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const pendingQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please resume me after the connection returns.",
    status: "pending",
  });

  const api = await mockQuestionApi({
    failAnswerRequestNumbers: [1],
    failStatusRequestNumbers: [1],
    initialQuestions: [pendingQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await expect(dialog.getByText("We couldn't finish this answer.")).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();

  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.answerRequests).toBe(2);
});

test("reconciles an answer that kept running after a reload", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please finish this running question.",
    status: "running",
  });

  const api = await mockQuestionApi({
    completeRunningAfterStatusRequest: 1,
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await expect(dialog.getByText(runningQuestion.question)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible({ timeout: 5000 });
  expect(api.getRequests).toBe(1);
  expect(api.statusRequests).toBe(1);
});

test("recovers an abandoned answer when the learner checks again", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const abandonedQuestion = {
    ...questionResource({
      context: { kind: "lesson" },
      question: "Please recover this interrupted answer.",
      status: "running",
    }),
    updatedAt: new Date(Date.now() - 180_000).toISOString(),
  };

  const api = await mockQuestionApi({
    initialQuestions: [abandonedQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("My follow-up question.");
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Check again" }).click();

  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
  expect(api.questions).toHaveLength(1);
  expect(api.answerRequests).toBe(1);
});

test("keeps waiting when another session is still generating the answer", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "lesson" },
    question: "Please wait for my other session.",
    status: "running",
  });

  const api = await mockQuestionApi({
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  // The server rejects duplicate claims while the original provider request is still active.
  await authenticatedPage.route(`**/v1/questions/${runningQuestion.id}/answers`, (route) =>
    route.fulfill({ json: { error: "Answer already in progress" }, status: 409 }),
  );

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("My follow-up question.");

  await Promise.all([
    authenticatedPage.waitForResponse(
      (response) =>
        response.url().endsWith(`/${runningQuestion.id}/answers`) && response.status() === 409,
    ),
    dialog.getByRole("button", { name: "Check again" }).click(),
  ]);

  await expect(dialog.getByRole("button", { name: "Check again" })).toBeEnabled();
  await expect(dialog.getByText("Thinking…")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).not.toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(api.answerRequests).toBe(0);

  api.questions = [{ ...runningQuestion, answer: ANSWER_TEXT, status: "completed" }];
  await dialog.getByRole("button", { name: "Check again" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
});

test("does not restart an answer when an older manual check arrives after polling completes", async ({
  subscriberPage: page,
}) => {
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "lesson" },
    question: "A question being answered elsewhere",
    status: "running",
  });

  const api = await mockQuestionApi({
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page,
  });

  const heldCheck = Promise.withResolvers<null>();
  const requests: string[] = [];
  const completedRequests: string[] = [];
  await page.clock.install({ time: new Date("2026-08-21T12:00:00.000Z") });

  // Load the lazy conversation before freezing timers, then reopen with polling under test control.
  await page.goto(scenario.url);
  await page.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Check again" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.clock.pauseAt(new Date("2026-08-21T13:00:00.000Z"));

  await page.route(`**/v1/questions/${runningQuestion.id}`, async (route) => {
    requests.push(route.request().url());
    const isFirst = requests.length === 1;

    if (isFirst) {
      await heldCheck.promise;
    }

    await route.fulfill({
      json: isFirst
        ? runningQuestion
        : { ...runningQuestion, answer: ANSWER_TEXT, status: "completed" },
    });

    completedRequests.push(route.request().url());
  });

  await page.getByRole("button", { name: "Ask about this lesson" }).click();

  try {
    await dialog.getByRole("button", { name: "Check again" }).click();
    await expect.poll(() => requests.length).toBe(1);
    await page.clock.fastForward(2000);
    await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  } finally {
    heldCheck.resolve(null);
  }

  await expect.poll(() => completedRequests.length).toBe(2);
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.answerRequests).toBe(0);
});

test("keeps polling a remote answer after a transient refresh failure", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please keep checking this answer.",
    status: "running",
  });

  const api = await mockQuestionApi({
    completeRunningAfterStatusRequest: 2,
    failStatusRequestNumbers: [1],
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible({ timeout: 7000 });
  expect(api.getRequests).toBe(1);
  expect(api.statusRequests).toBe(2);
});

test("pauses remote answer polling while the learner is offline", async ({
  subscriberPage: authenticatedPage,
}) => {
  await authenticatedPage.clock.install({ time: new Date("2026-08-21T12:00:00.000Z") });
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please wait until the connection returns.",
    status: "running",
  });

  const api = await mockQuestionApi({
    completeRunningAfterStatusRequest: 1,
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByText(runningQuestion.question)).toBeVisible();

  await authenticatedPage.context().setOffline(true);
  await authenticatedPage.clock.fastForward(10_000);
  expect(api.statusRequests).toBe(0);

  await authenticatedPage.context().setOffline(false);
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.statusRequests).toBe(1);
});

test("stops polling and offers sign-in when a remote answer loses its session", async ({
  subscriberPage: authenticatedPage,
}) => {
  await authenticatedPage.clock.install({ time: new Date("2026-08-21T12:00:00.000Z") });
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please stop checking after my session expires.",
    status: "running",
  });

  const api = await mockQuestionApi({
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    statusErrorStatuses: { 1: 401 },
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await expect(dialog.getByText(runningQuestion.question)).toBeVisible();
  await authenticatedPage.clock.fastForward(1600);
  await expect(dialog.getByText(/session expired/iu)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Sign in" })).toBeVisible();

  await authenticatedPage.clock.fastForward(5000);
  expect(api.getRequests).toBe(1);
  expect(api.statusRequests).toBe(1);
});

test("offers plan selection when a manual answer check loses question access", async ({
  subscriberPage: authenticatedPage,
}) => {
  await authenticatedPage.clock.install({ time: new Date("2026-08-21T12:00:00.000Z") });
  const scenario = await createQuestionLesson();

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please check this answer manually.",
    status: "running",
  });

  const api = await mockQuestionApi({
    initialQuestions: [runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    statusErrorStatuses: { 1: 402 },
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();

  const dialog = authenticatedPage.getByRole("dialog");

  await dialog.getByRole("button", { name: "Check again" }).click();
  await expect(dialog.getByText("Subscribe to ask questions")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "View plans" })).toBeVisible();

  expect(api.answerRequests).toBe(0);
  expect(api.statusRequests).toBe(1);
});

test("refreshes saved questions whenever the panel is reopened", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const firstQuestion = questionResource({
    answer: ANSWER_TEXT,
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "A question from this tab.",
    status: "completed",
  });

  const api = await mockQuestionApi({
    initialQuestions: [firstQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByText(firstQuestion.question)).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");

  const remoteQuestion = questionResource({
    answer: "An answer created in another client.",
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "A question from another client.",
    status: "completed",
  });

  api.questions = [...api.questions, remoteQuestion];

  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect(dialog.getByText(remoteQuestion.question)).toBeVisible();
  await expect(dialog.getByText(remoteQuestion.answer ?? "")).toBeVisible();
  expect(api.getRequests).toBeGreaterThanOrEqual(2);
});

test("announces the initial question history load", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const api = await mockQuestionApi({
    holdGetRequestNumbers: [1],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();

  const dialog = authenticatedPage.getByRole("dialog");
  const loadingStatus = dialog.getByRole("status");

  await expect(loadingStatus).toBeVisible();
  await expect(loadingStatus).toHaveText("Loading questions…");
  api.releaseGetResponse(1);
  await expect(loadingStatus).toHaveCount(0);
  await expect(dialog.getByText("What would you like help with?")).toBeVisible();
});

test("reveals saved questions and answers together when conversation code loads slowly", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson({ staticOnly: true });

  const savedQuestion = questionResource({
    answer: `### Staying in orbit\n\n${ANSWER_TEXT}`,
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Why doesn't the satellite fall straight down?",
    status: "completed",
  });

  const api = await mockQuestionApi({
    initialQuestions: [savedQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.setViewportSize({ height: 812, width: 375 });
  await authenticatedPage.goto(scenario.url);
  const askButton = authenticatedPage.getByRole("button", { name: "Ask about this lesson" });
  await expect(askButton).toBeVisible();

  const scriptRequested = Promise.withResolvers<null>();
  const releaseScripts = Promise.withResolvers<null>();

  // Hold real lazy-loaded scripts to reproduce a cold, slow connection without mocking the renderer.
  await authenticatedPage.route("**/_next/static/chunks/*.js", async (route) => {
    scriptRequested.resolve(null);
    await releaseScripts.promise;
    await route.continue();
  });

  const dialog = authenticatedPage.getByRole("dialog");

  try {
    await askButton.click();
    await scriptRequested.promise;
    await expect.poll(() => api.completedGetRequests).toBe(1);

    await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Copy lesson content" })).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText("Loading questions…");
    await expect(dialog.getByText(savedQuestion.question)).toHaveCount(0);
    await dialog.getByRole("textbox", { name: "Ask a question" }).fill("My follow-up question");
  } finally {
    releaseScripts.resolve(null);
  }

  await expect(dialog.getByRole("heading", { name: "Staying in orbit" })).toBeVisible();
  await expect(dialog.getByText(savedQuestion.question)).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveCount(0);

  await expect(dialog.getByRole("textbox", { name: "Ask a question" })).toHaveValue(
    "My follow-up question",
  );
});

test("keeps saved history visible but blocks sending during a reopen refresh", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const savedQuestion = questionResource({
    answer: ANSWER_TEXT,
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "A saved question remains visible while refreshing.",
    status: "completed",
  });

  const api = await mockQuestionApi({
    holdGetRequestNumbers: [2],
    initialQuestions: [savedQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByText(savedQuestion.question)).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");

  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect.poll(() => api.getRequests).toBe(2);
  await expect(dialog.getByText(savedQuestion.question)).toBeVisible();
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Wait for the refresh.");
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();

  api.releaseGetResponse(2);
  await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
});

test("ignores an older reopen response that arrives after a newer refresh", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const firstQuestion = questionResource({
    answer: "Initial answer",
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Initial saved question",
    status: "completed",
  });

  const staleQuestion = questionResource({
    answer: "Stale answer",
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Stale saved question",
    status: "completed",
  });

  const newestQuestion = questionResource({
    answer: "Newest answer",
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Newest saved question",
    status: "completed",
  });

  const api = await mockQuestionApi({
    holdGetRequestNumbers: [2],
    initialQuestions: [firstQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByText(firstQuestion.question)).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");

  api.questions = [staleQuestion];
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect.poll(() => api.getRequests).toBe(2);
  await authenticatedPage.keyboard.press("Escape");

  api.questions = [newestQuestion];
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect(dialog.getByText(newestQuestion.question)).toBeVisible();
  await expect(dialog.getByText(staleQuestion.question)).toHaveCount(0);

  api.releaseGetResponse(2);
  await expect.poll(() => api.completedGetRequests).toBe(3);
  await expect(dialog.getByText(newestQuestion.question)).toBeVisible();
  await expect(dialog.getByText(staleQuestion.question)).toHaveCount(0);
});

test("loads earlier saved questions without dropping the latest page", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const savedQuestions = [
    "Oldest saved question",
    "Middle saved question",
    "Latest saved question",
  ].map((question) =>
    questionResource({
      answer: `${question} answer`,
      context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
      question,
      status: "completed",
    }),
  );

  const api = await mockQuestionApi({
    initialQuestions: savedQuestions,
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    threadPageSize: 2,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await expect(dialog.getByText("Oldest saved question")).toHaveCount(0);
  await expect(dialog.getByText("Middle saved question", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Latest saved question", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Load earlier questions" }).click();

  await expect(dialog.getByText("Oldest saved question", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Middle saved question", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Latest saved question", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Load earlier questions" })).toHaveCount(0);

  await authenticatedPage.keyboard.press("Escape");
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  await expect.poll(() => api.completedGetRequests).toBe(3);
  await expect(dialog.getByText("Oldest saved question", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Load earlier questions" })).toHaveCount(0);
});

test("ignores an earlier page that finishes after the latest page refreshes", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const savedQuestions = [
    "Old question before refresh",
    "Middle question before refresh",
    "Latest question before refresh",
  ].map((question) =>
    questionResource({
      answer: `${question} answer`,
      context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
      question,
      status: "completed",
    }),
  );

  const api = await mockQuestionApi({
    holdGetRequestNumbers: [2],
    initialQuestions: savedQuestions,
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    threadPageSize: 2,
  });

  await authenticatedPage.goto(scenario.url);

  const openQuestions = authenticatedPage.getByRole("button", { name: "Ask about this lesson" });

  await openQuestions.click();
  const dialog = authenticatedPage.getByRole("dialog");
  const loadEarlier = dialog.getByRole("button", { name: "Load earlier questions" });

  await expect(dialog.getByText("Middle question before refresh", { exact: true })).toBeVisible();
  await loadEarlier.click();
  await expect.poll(() => api.getRequests).toBe(2);

  const latestQuestion = questionResource({
    answer: "Latest question after refresh answer",
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Latest question after refresh",
    status: "completed",
  });

  api.questions = [...api.questions, latestQuestion];

  await authenticatedPage.keyboard.press("Escape");
  await openQuestions.click();
  await expect(dialog.getByText(latestQuestion.question, { exact: true })).toBeVisible();

  api.releaseGetResponse(2);
  await expect.poll(() => api.completedGetRequests).toBe(3);
  await expect(dialog.getByText("Old question before refresh", { exact: true })).toHaveCount(0);
  await expect(loadEarlier).toBeVisible();

  await loadEarlier.click();
  await expect(dialog.getByText("Old question before refresh", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Middle question before refresh", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Latest question before refresh", { exact: true })).toBeVisible();
  await expect(dialog.getByText(latestQuestion.question, { exact: true })).toBeVisible();
});

test("keeps earlier history while the latest answer is reconciled", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const olderQuestion = questionResource({
    answer: "An older saved answer.",
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "An older saved question.",
    status: "completed",
  });

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "The latest answer is still running.",
    status: "running",
  });

  await mockQuestionApi({
    completeRunningAfterStatusRequest: 2,
    initialQuestions: [olderQuestion, runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    threadPageSize: 1,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await dialog.getByRole("button", { name: "Load earlier questions" }).click();

  await expect(dialog.getByText(olderQuestion.question)).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible({ timeout: 7000 });
  await expect(dialog.getByText(olderQuestion.question)).toBeVisible();
  await expect(dialog.getByText(olderQuestion.answer ?? "")).toBeVisible();
});

test("keeps a streamed answer in view while the learner follows the bottom", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const history = Array.from({ length: 8 }, (_, index) =>
    questionResource({
      answer: `Saved explanation ${index}: ${ANSWER_TEXT}`,
      context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
      question: `Saved question ${index}`,
      status: "completed",
    }),
  );

  const finalTail = "STREAM_FINAL_TAIL";

  await installStreamingAnswerResponse({
    chunks: [
      "Starting the explanation. ",
      `${"This adds enough detail for the answer to grow naturally. ".repeat(25)} `,
      `${"The next idea builds on the previous one. ".repeat(25)} `,
      finalTail,
    ],
    delayMilliseconds: 150,
    page: authenticatedPage,
  });

  await mockQuestionApi({
    initialQuestions: history,
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  const questionLog = dialog.getByRole("log", { name: "Questions about this lesson" });
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Stream this answer.");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByText(new RegExp(finalTail, "u"))).toBeVisible();

  await expect
    .poll(() =>
      questionLog.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(48);
});

test("does not move a learner who scrolls up while an answer streams", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const history = Array.from({ length: 8 }, (_, index) =>
    questionResource({
      answer: `Earlier explanation ${index}: ${ANSWER_TEXT}`,
      context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
      question: `Earlier question ${index}`,
      status: "completed",
    }),
  );

  const firstChunk = "STREAM_STARTED";
  const finalTail = "STREAM_FINISHED";

  await installStreamingAnswerResponse({
    chunks: [
      firstChunk,
      `${" A deliberately long streamed explanation continues here.".repeat(30)} `,
      `${"More grounded detail arrives after the learner scrolls away.".repeat(30)} `,
      finalTail,
    ],
    delayMilliseconds: 250,
    page: authenticatedPage,
  });

  await mockQuestionApi({
    initialQuestions: history,
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.setViewportSize({ height: 812, width: 375 });
  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  const questionLog = dialog.getByRole("log", { name: "Questions about this lesson" });

  await dialog
    .getByRole("textbox", { name: "Ask a question" })
    .fill("Let me read while this streams.");

  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(new RegExp(firstChunk, "u"))).toBeVisible();

  await questionLog.hover();
  await authenticatedPage.mouse.wheel(0, -10_000);
  await expect.poll(() => questionLog.evaluate((element) => element.scrollTop)).toBe(0);

  await expect(dialog.getByText(new RegExp(finalTail, "u"))).toBeAttached();
  await expect.poll(() => questionLog.evaluate((element) => element.scrollTop)).toBe(0);
});

test("checks an interrupted running answer before retrying an older failure", async ({
  subscriberPage: authenticatedPage,
}) => {
  await authenticatedPage.clock.install({ time: new Date("2026-08-21T12:00:00.000Z") });
  const scenario = await createQuestionLesson();

  const failedQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please retry this older failed question.",
    status: "failed",
  });

  const runningQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please reclaim this interrupted question first.",
    status: "running",
  });

  const api = await mockQuestionApi({
    completeRunningAfterStatusRequest: 1,
    initialQuestions: [failedQuestion, runningQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  const retryButton = dialog.getByRole("button", { name: "Try again" });

  await expect(retryButton).toBeDisabled();
  await dialog.getByRole("button", { name: "Check again" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(1);
  await expect(retryButton).toBeEnabled();

  await retryButton.click();
  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(2);
  expect(api.answerRequests).toBe(1);
  expect(api.statusRequests).toBe(1);
});

test("blocks a new question until a failed answer is retried", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const failedQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Please retry this answer before my follow-up.",
    status: "failed",
  });

  const api = await mockQuestionApi({
    initialQuestions: [failedQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");

  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("A follow-up question.");
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();

  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(2);
  expect(api.answerRequests).toBe(2);
});

test("explains correct and incorrect answers on demand with validated answer context", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.setViewportSize({ height: 812, width: 375 });
  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("radio", { name: scenario.wrongOption }).click();
  await authenticatedPage.getByRole("button", { name: /check/iu }).click();
  await expect(authenticatedPage.getByText(scenario.hiddenFeedback)).toBeVisible();
  expect(api.inputs).toHaveLength(0);

  await authenticatedPage.getByRole("button", { name: "Explain answer" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();

  await expect(
    dialog.getByText("Why was my answer wrong? Explain the correct answer."),
  ).toBeVisible();

  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();

  expect(api.inputs[0]).toMatchObject({
    context: {
      answer: { kind: "multipleChoice", selectedOptionId: scenario.wrongOptionId },
      kind: "answer",
      stepId: scenario.stepIds[0],
      stepNumber: 1,
    },
    question: "Why was my answer wrong? Explain the correct answer.",
  });

  await authenticatedPage.keyboard.press("Escape");
  await authenticatedPage.getByRole("button", { name: "Explain answer" }).click();

  await expect(
    dialog.getByText("Why was my answer wrong? Explain the correct answer."),
  ).toHaveCount(1);

  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(1);
  expect(api.questions).toHaveLength(1);
  expect(api.answerRequests).toBe(1);

  await authenticatedPage.keyboard.press("Escape");
  await authenticatedPage.reload();
  await authenticatedPage.getByRole("radio", { name: scenario.correctOption }).click();
  await authenticatedPage.getByRole("button", { name: /check/iu }).click();
  await authenticatedPage.getByRole("button", { name: "Explain answer" }).click();

  await expect(dialog.getByText("Why is this answer correct?")).toBeVisible();
  await expect(dialog.getByText(ANSWER_TEXT)).toHaveCount(2);

  expect(api.inputs.at(-1)).toMatchObject({
    context: {
      answer: { kind: "multipleChoice", selectedOptionId: scenario.correctOptionId },
      kind: "answer",
      stepId: scenario.stepIds[0],
      stepNumber: 1,
    },
    question: "Why is this answer correct?",
  });
});

async function expectReopenedSavedExplanation({
  page: authenticatedPage,
  pageSize,
}: {
  page: Page;
  pageSize: number;
}) {
  const scenario = await createQuestionLesson();

  const api = await mockQuestionApi({
    lessonId: scenario.lessonId,
    page: authenticatedPage,
    threadPageSize: pageSize,
  });

  await authenticatedPage.setViewportSize({ height: 812, width: 375 });
  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("radio", { name: scenario.wrongOption }).click();
  await authenticatedPage.getByRole("button", { name: /check/iu }).click();
  const explainAnswer = authenticatedPage.getByRole("button", { name: "Explain answer" });
  await explainAnswer.click();

  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");

  const followUps = Array.from({ length: 6 }, (_, index) => ({
    ...questionResource({
      answer: `Follow-up explanation ${index}. ${"Gravity bends the satellite's path. ".repeat(12)}`,
      context: { kind: "lesson" },
      question: `Follow-up question ${index}`,
      status: "completed",
    }),
    createdAt: new Date(Date.now() + index + 1).toISOString(),
  }));

  api.questions = [...api.questions, ...followUps];
  await explainAnswer.click();

  await expect(
    dialog
      .getByRole("article", { name: "Your question" })
      .getByText("Why was my answer wrong? Explain the correct answer."),
  ).toBeInViewport();

  await expect(dialog.getByText(ANSWER_TEXT)).toBeInViewport();
  expect(api.questions).toHaveLength(7);
  expect(api.answerRequests).toBe(1);

  const loadEarlier = dialog.getByRole("button", { name: "Load earlier questions" });

  async function loadAllEarlierQuestions() {
    if (!(await loadEarlier.isVisible())) {
      return;
    }

    const completedRequests = api.completedGetRequests;
    await loadEarlier.click();
    await expect.poll(() => api.completedGetRequests).toBeGreaterThan(completedRequests);
    await loadAllEarlierQuestions();
  }

  await loadAllEarlierQuestions();

  const turns = dialog.getByRole("article", { name: "Your question" });
  await expect(turns).toHaveCount(7);
  await expect(turns.nth(0)).toContainText(ANSWER_TEXT);

  await Promise.all(
    followUps.map((question, index) =>
      expect(turns.nth(index + 1)).toContainText(question.question),
    ),
  );
}

test("reopens the saved explanation after follow-ups in the loaded page", async ({
  subscriberPage,
}) => {
  await expectReopenedSavedExplanation({ page: subscriberPage, pageSize: 50 });
});

test("reopens the saved explanation outside the latest page", async ({ subscriberPage }) => {
  await expectReopenedSavedExplanation({ page: subscriberPage, pageSize: 2 });
});

test("keeps questions accessible while an active answer blocks automatic explanation", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();
  const releaseFirstAnswerEvent = "zoonk:e2e-release-first-lesson-question-answer";

  await installStreamingAnswerResponse({
    chunks: ["FIRST_ANSWER_STARTED", " FIRST_ANSWER_FINISHED"],
    delayMilliseconds: 0,
    maxStreamedAnswers: 1,
    page: authenticatedPage,
    releaseAfterFirstChunkEvent: releaseFirstAnswerEvent,
  });

  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();

  const dialog = authenticatedPage.getByRole("dialog");

  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Explain this first.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(/FIRST_ANSWER_STARTED/u)).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");

  await authenticatedPage.getByRole("radio", { name: scenario.wrongOption }).click();
  await authenticatedPage.getByRole("button", { name: /check/iu }).click();

  const openQuestions = authenticatedPage.getByRole("button", { name: "Open questions" });

  await expect(openQuestions).toBeEnabled();
  await openQuestions.click();
  await expect(dialog.getByText(/FIRST_ANSWER_STARTED/u)).toBeVisible();

  await authenticatedPage.evaluate((eventName) => {
    globalThis.dispatchEvent(new Event(eventName));
  }, releaseFirstAnswerEvent);

  await expect(dialog.getByLabel("Answering")).toHaveCount(0);

  api.questions = api.questions.map((question) => ({
    ...question,
    answer: "The first answer completed.",
    status: "completed",
  }));

  await authenticatedPage.keyboard.press("Escape");
  const explainAnswer = authenticatedPage.getByRole("button", { name: "Explain answer" });
  await expect(explainAnswer).toBeEnabled();
  await explainAnswer.click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();

  expect(api.inputs).toHaveLength(2);
  expect(api.answerRequests).toBe(1);
});

test("automatically explains after a stale blocker finishes elsewhere", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson();

  const failedQuestion = questionResource({
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "An interrupted question from this lesson.",
    status: "failed",
  });

  const api = await mockQuestionApi({
    initialQuestions: [failedQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByText(failedQuestion.question)).toBeVisible();
  await authenticatedPage.keyboard.press("Escape");

  api.questions = [
    { ...failedQuestion, answer: "This answer finished in another tab.", status: "completed" },
  ];

  await authenticatedPage.getByRole("radio", { name: scenario.wrongOption }).click();
  await authenticatedPage.getByRole("button", { name: /check/iu }).click();
  await authenticatedPage.getByRole("button", { name: "Explain answer" }).click();

  await expect(
    dialog.getByText("Why was my answer wrong? Explain the correct answer."),
  ).toBeVisible();

  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.inputs).toHaveLength(1);
});

test("asks from structural lesson completion with every displayed step", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson({ staticOnly: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page: authenticatedPage });

  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Next step" }).click();
  await advanceToCompletionSummary({ page: authenticatedPage });
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();
  const dialog = authenticatedPage.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Ask a question" }).fill("Summarize this lesson.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.inputs[0]).toMatchObject({ context: { kind: "lesson", stepIds: scenario.stepIds } });
});

test("reopens saved mobile history without moving focus into the composer", async ({
  subscriberPage: authenticatedPage,
}) => {
  const scenario = await createQuestionLesson({ staticOnly: true });
  const longQuestion = `https://example.test/${"question".repeat(80)}`;
  const longAnswer = `https://example.test/${"answer".repeat(100)}`;

  const savedQuestion = questionResource({
    answer: longAnswer,
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: longQuestion,
    status: "completed",
  });

  await mockQuestionApi({
    initialQuestions: [savedQuestion],
    lessonId: scenario.lessonId,
    page: authenticatedPage,
  });

  await authenticatedPage.setViewportSize({ height: 812, width: 375 });
  await authenticatedPage.goto(scenario.url);
  await authenticatedPage.getByRole("button", { name: "Ask about this lesson" }).click();

  const dialog = authenticatedPage.getByRole("dialog");
  const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
  const title = dialog.getByRole("heading", { name: "Ask questions" });
  const close = dialog.getByRole("button", { name: "Close questions" });
  const copy = dialog.getByRole("button", { name: "Copy lesson content" });
  const log = dialog.getByRole("log", { name: "Questions about this lesson" });

  await expect(dialog.getByText(savedQuestion.question)).toBeVisible();
  await expect(dialog.getByText(longAnswer)).toBeVisible();
  await expect(title).toBeVisible();
  await expect(close).toBeVisible();
  await expect(copy).toBeVisible();
  await expect(textbox).not.toBeFocused();

  const [dialogBox, titleBox, closeBox, copyBox, logBox] = await Promise.all([
    getRequiredElementBox(dialog),
    getRequiredElementBox(title),
    getRequiredElementBox(close),
    getRequiredElementBox(copy),
    getRequiredElementBox(log),
  ]);

  const headerBottom = Math.max(
    titleBox.y + titleBox.height,
    closeBox.y + closeBox.height,
    copyBox.y + copyBox.height,
  );

  expect(titleBox.width).toBeGreaterThan(80);
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
  expect(logBox.y).toBeGreaterThanOrEqual(headerBottom);
});

test("lets a signed-in learner ask about a free lesson without subscribing", async ({
  authenticatedPage: nonSubscriberPage,
}) => {
  const scenario = await createQuestionLesson({ staticOnly: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page: nonSubscriberPage });

  await nonSubscriberPage.setViewportSize({ height: 812, width: 375 });
  await nonSubscriberPage.goto(scenario.url);
  await nonSubscriberPage.getByRole("button", { name: "Ask about this lesson" }).click();

  const dialog = nonSubscriberPage.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();
  const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
  await expect(textbox).toBeVisible();
  await textbox.fill("Can you explain this another way?");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
  expect(api.getRequests).toBe(1);
  expect(api.answerRequests).toBe(1);
  expect(api.statusRequests).toBe(0);
});

test("keeps the mobile guest flow focused on sign-in or copying lesson content", async ({
  page,
}) => {
  const scenario = await createQuestionLesson({ staticOnly: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(scenario.url);
  await page.getByRole("button", { name: "Continue without saving" }).click();
  await page.getByRole("button", { name: "Ask about this lesson" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();
  await expect(dialog.getByText("Sign in to ask questions")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Ask a question" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Copy lesson content" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(api.getRequests).toBe(0);
  expect(api.statusRequests).toBe(0);

  const lessonUrl = page.url();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(page.url()).toBe(lessonUrl);
});
