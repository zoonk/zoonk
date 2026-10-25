import { randomUUID } from "node:crypto";
import { type Page, type Request, type Route } from "@playwright/test";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { fulfillTutorAnswer } from "./tutor-answer";

const FORMATTED_ANSWER = [
  "### Key idea",
  "- **Gravity** bends the path.\n- [Velocity](https://example.com) carries it forward.\n  - Tangential motion matters.",
  "1. Measure the speed.\n2. Compare the direction.",
  "> An orbit is continuous free fall.",
  "Use `orbitalSpeed` for the speed.",
  "```javascript\nconst orbitalSpeed = 7.8;\nconsole.log(orbitalSpeed);\n```",
  "| Quantity | Unit |\n| --- | --- |\n| Speed | km/s |",
  String.raw`The mean radius is $$\overline{r}$$ and the speed is:`,
  "$$\nv = \\sqrt{\\frac{GM}{r}}\n$$",
  "```mermaid\nflowchart TD\n  accTitle: How an orbit forms\n  accDescr: Gravity and forward motion produce an orbit.\n  A[Gravity] --> B[Orbit]\n  C[Forward motion] --> B\n```",
].join("\n\n");

/** How long no script loads before the page counts as done loading what it reads ahead. */
const SCRIPTS_SETTLED_MS = 1000;

function isScript(request: Request) {
  return request.url().includes("/_next/static/chunks/");
}

const ANSWER_TEXT = "Gravity keeps pulling while the satellite moves forward, bending its path.";

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

  return {
    answer,
    context,
    createdAt: now,
    id: randomUUID(),
    planChange: null,
    question,
    status,
    toolOffer: null,
    updatedAt: now,
  };
}

type QuestionLessonScenario = {
  correctOption: string;
  lessonId: string;
  question: string;
  stepIds: string[];
  stepTitles: string[];
  url: string;
  wrongOption: string;
};

/**
 * A Library lesson played in the lesson player, whose tutor is the questions sheet: a check (or,
 * with `staticOnly`, an explanation) first, then optionally an explanation.
 */
async function createQuestionLesson({
  includeSecondStep = false,
  language = "en",
  staticOnly = false,
}: {
  includeSecondStep?: boolean;
  language?: string;
  staticOnly?: boolean;
} = {}): Promise<QuestionLessonScenario> {
  // A letter first: an id of digits alone reads as a number, which the lesson writes grouped.
  const uniqueId = `q${randomUUID().slice(0, 8)}`;
  const question = `Why does a satellite stay in orbit ${uniqueId}?`;
  const correctOption = `Gravity bends its path ${uniqueId}`;
  const wrongOption = `There is no gravity ${uniqueId}`;
  const stepTitles = [`Orbit concept ${uniqueId}`, `A second perspective ${uniqueId}`];

  const firstStep = staticOnly
    ? { content: { text: question, title: stepTitles[0] }, kind: "explanation" as const }
    : {
        content: {
          options: [
            { id: `right-${uniqueId}`, isCorrect: true, reason: "Right.", text: correctOption },
            {
              id: `wrong-${uniqueId}`,
              isCorrect: false,
              reason: `Gravity is still there ${uniqueId}`,
              text: wrongOption,
            },
          ],
          question,
        },
        kind: "check" as const,
      };

  const secondStep = {
    content: { text: `An orbit is continuous free fall ${uniqueId}.`, title: stepTitles[1] },
    kind: "explanation" as const,
  };

  const { lesson, steps } = await playableLessonFixture({
    lesson: { language, title: `Staying in orbit ${uniqueId}` },
    steps: includeSecondStep ? [firstStep, secondStep] : [firstStep],
  });

  return {
    correctOption,
    lessonId: lesson.id,
    question,
    stepIds: steps.map((step) => step.id),
    stepTitles: includeSecondStep ? stepTitles : stepTitles.slice(0, 1),
    url: `/learn/${lesson.id}`,
    wrongOption,
  };
}

/** Picks an option on the check and checks it, as the learner would. */
async function checkOption(page: Page, option: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
}

function getContextSummary(
  context: CreateLessonQuestionInput["context"],
): LessonQuestionContextSummary {
  if (context.kind !== "step" && context.kind !== "answer") {
    return { kind: context.kind };
  }

  return { kind: context.kind, stepId: context.stepId, stepNumber: context.stepNumber };
}

function expectBearerAuthorization(route: Route) {
  expect(route.request().headers().authorization).toMatch(/^Bearer .+/u);
}

function matchesQuestionScope({
  question,
  stepId,
  contextKind,
}: {
  question: LessonQuestionResource;
  stepId: string | null;
  contextKind: string | null;
}) {
  if (stepId && (!("stepId" in question.context) || question.context.stepId !== stepId)) {
    return false;
  }

  return !contextKind || question.context.kind === contextKind;
}

/**
 * The tutor's API routes, answered like the API: each screen's thread, new questions and their
 * streamed answers. The player's browser tests cover how the tutor handles failures and late or
 * unfinished answers; these tests check the app's wiring to the routes.
 */
async function mockQuestionApi({
  initialQuestions = [],
  lessonId,
  page,
}: {
  initialQuestions?: LessonQuestionResource[];
  lessonId: string;
  page: Page;
}) {
  const threadId = randomUUID();

  const state: {
    answerRequests: number;
    completedGetRequests: number;
    getRequests: number;
    inputs: CreateLessonQuestionInput[];
    questions: LessonQuestionResource[];
    statusRequests: number;
  } = {
    answerRequests: 0,
    completedGetRequests: 0,
    getRequests: 0,
    inputs: [],
    questions: initialQuestions,
    statusRequests: 0,
  };

  await page.route("**/v1/lessons/**/questions*", async (route) => {
    expectBearerAuthorization(route);

    if (route.request().method() === "GET") {
      state.getRequests += 1;
      const searchParams = new URL(route.request().url()).searchParams;
      const stepId = searchParams.get("stepId");
      const contextKind = searchParams.get("contextKind");

      const questions = state.questions.filter((question) =>
        matchesQuestionScope({ contextKind, question, stepId }),
      );

      const responseJson =
        state.questions.length === 0
          ? null
          : { hasMore: false, id: threadId, lessonId, nextCursor: null, questions };

      await route.fulfill({ contentType: "application/json", json: responseJson, status: 200 });
      state.completedGetRequests += 1;

      return;
    }

    const input = createLessonQuestionInputSchema.parse(route.request().postDataJSON());
    state.inputs = [...state.inputs, input];
    const now = new Date().toISOString();

    const question: LessonQuestionResource = {
      answer: null,
      context: getContextSummary(input.context),
      createdAt: now,
      id: randomUUID(),
      planChange: null,
      question: input.question,
      status: "pending",
      toolOffer: null,
      updatedAt: now,
    };

    state.questions = [...state.questions, question];
    await route.fulfill({ contentType: "application/json", json: question, status: 201 });
  });

  await page.route("**/v1/questions/*", async (route) => {
    expectBearerAuthorization(route);
    state.statusRequests += 1;
    const questionId = new URL(route.request().url()).pathname.split("/").at(-1);
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

    state.questions = state.questions.map((question) =>
      question.id === questionId
        ? { ...question, answer: ANSWER_TEXT, status: "completed" }
        : question,
    );

    await fulfillTutorAnswer(route, ANSWER_TEXT);
  });

  return state;
}

test.describe("The tutor", () => {
  test("asks from the screen in view and follows up on the next one in its own thread", async ({
    userWithoutProgress: page,
  }) => {
    // Any signed-in learner can ask, without a subscription or progress.
    const scenario = await createQuestionLesson({ includeSecondStep: true });
    const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

    await page.goto(scenario.url);
    await expect(page.getByText(scenario.question)).toBeVisible();
    const lessonUrl = page.url();

    // The screen's history preloads once the page is interactive. On a wide screen the buddy is
    // beside the lesson: its composer at the foot of the aside, about the screen in view.
    await expect.poll(() => api.getRequests).toBe(1);
    const aside = page.getByRole("complementary", { name: "Help with this screen" });
    const textbox = aside.getByRole("textbox", { name: "Ask a question" });
    await expect(textbox).toHaveAttribute("placeholder", "Ask Zu about this screen");

    const firstQuestion = `Can you explain this orbit ${randomUUID().slice(0, 6)}?`;
    await textbox.fill(firstQuestion);
    await textbox.press("Enter");

    // The conversation shows in the aside, with the question still beside it.
    const conversation = page.getByRole("region", { name: "Questions to Zu" });
    await expect(conversation.getByText(ANSWER_TEXT)).toBeVisible();
    await expect(page.getByText(scenario.question)).toBeVisible();
    expect(api.getRequests).toBe(1);
    expect(api.answerRequests).toBe(1);
    expect(api.statusRequests).toBe(0);

    expect(api.inputs[0]).toMatchObject({
      context: { kind: "step", stepId: scenario.stepIds[0], stepNumber: 1 },
      question: firstQuestion,
    });

    await conversation.getByRole("button", { name: "From the lesson" }).click();
    await expect(conversation).not.toBeVisible();
    expect(page.url()).toBe(lessonUrl);
    await expect(page.getByRole("radio", { name: scenario.wrongOption })).not.toBeChecked();

    await checkOption(page, scenario.correctOption);
    await page.getByRole("button", { name: /^Continue/u }).click();
    const secondStepTitle = scenario.stepTitles[1];

    if (!secondStepTitle) {
      throw new Error("Question follow-up scenario is missing its second step");
    }

    await expect(page.getByText(secondStepTitle)).toBeVisible();

    // The next screen's questions are its own thread.
    const followUp = "How does that connect to free fall?";
    await aside.getByRole("textbox", { name: "Ask a question" }).fill(followUp);
    await aside.getByRole("button", { name: "Send" }).click();
    await expect(conversation.getByText(followUp)).toBeVisible();
    await expect(conversation.getByText(firstQuestion)).not.toBeVisible();
    await expect.poll(() => api.inputs.length).toBe(2);

    expect(api.inputs[1]).toMatchObject({
      context: { kind: "step", stepId: scenario.stepIds[1], stepNumber: 2 },
      question: followUp,
    });
  });
});

/**
 * Opens the tutor on the lesson's first screen and taps "another example", as its chip reads: in
 * the drawer of a tablet in portrait, whose empty thread offers each of the lesson's suggestions.
 */
async function tapExample({ language, page }: { language: string; page: Page }) {
  const scenario = await createQuestionLesson({ language, staticOnly: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

  await page.setViewportSize({ height: 1180, width: 820 });
  await page.goto(scenario.url);
  await page.getByRole("button", { name: "Ask Zu" }).click();

  const chips = page.getByRole("dialog").locator('[data-slot="empty-content"]').getByRole("button");

  await expect(chips).toHaveCount(3);
  const example = chips.nth(2);
  const label = await example.innerText();

  await example.click();
  await expect.poll(() => api.inputs.length).toBe(1);

  return { input: api.inputs[0], label };
}

test.describe("The tutor's suggestions", () => {
  test("read the lesson's language from its payload and send which one was tapped, in those words", async ({
    userWithoutProgress: page,
  }) => {
    const english = await tapExample({ language: "en", page });

    expect(english).toMatchObject({
      input: { question: "Give me another example", suggestion: "example" },
      label: "Give me another example",
    });

    // A lesson in Portuguese suggests in Portuguese, whatever the app's language.
    const portuguese = await tapExample({ language: "pt", page });

    expect(portuguese.label).not.toBe(english.label);
    expect(portuguese.input).toMatchObject({ question: portuguese.label, suggestion: "example" });
  });
});

test("renders preloaded Markdown immediately while optional scripts load", async ({
  userWithoutProgress: page,
}) => {
  const scenario = await createQuestionLesson();

  const savedQuestion = questionResource({
    answer: FORMATTED_ANSWER,
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Show the orbit with examples",
    status: "completed",
  });

  const api = await mockQuestionApi({
    initialQuestions: [savedQuestion],
    lessonId: scenario.lessonId,
    page,
  });

  const scripts = { inFlight: 0, lastActivity: Date.now() };

  page.on("request", (request) => {
    if (isScript(request)) {
      scripts.inFlight += 1;
      scripts.lastActivity = Date.now();
    }
  });

  const settle = (request: Request) => {
    if (isScript(request)) {
      scripts.inFlight -= 1;
      scripts.lastActivity = Date.now();
    }
  };

  page.on("requestfinished", settle);
  page.on("requestfailed", settle);

  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(scenario.url);
  await expect.poll(() => api.completedGetRequests).toBe(1);
  scripts.lastActivity = Date.now();
  await expect(page.getByRole("button", { name: "Ask Zu" })).toBeVisible();

  // A thread read ahead with answers loads their renderer and math as it arrives, before the
  // learner asks: hold scripts only once none has loaded for a while since it arrived.
  await expect
    .poll(() => scripts.inFlight === 0 && Date.now() - scripts.lastActivity > SCRIPTS_SETTLED_MS)
    .toBe(true);

  const releaseScripts = Promise.withResolvers<null>();
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));

  // Diagram rendering and code highlighting must not delay the rest of a saved answer.
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    await releaseScripts.promise;
    await route.continue();
  });

  const dialog = page.getByRole("dialog");

  try {
    await page.getByRole("button", { name: "Ask Zu" }).click();
    await expect(dialog.getByRole("heading", { name: "Key idea" })).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveCount(0);
    expect(api.getRequests).toBe(1);
    await expect(dialog.getByRole("listitem")).toHaveCount(5);
    await expect(dialog.getByRole("math")).toHaveCount(2);

    await expect(
      dialog.getByRole("table").getByRole("columnheader", { name: "Quantity" }),
    ).toBeVisible();

    await expect
      .poll(() => dialog.getByRole("code").filter({ hasText: "const orbitalSpeed" }).innerText())
      .toContain(";\nconsole.log");
  } finally {
    releaseScripts.resolve(null);
  }

  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(dialog.getByRole("document", { name: "How an orbit forms" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps the mobile visitor flow focused on creating an account", async ({ page }) => {
  const scenario = await createQuestionLesson({ staticOnly: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(scenario.url);
  await page.getByRole("button", { name: "Ask Zu" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Zu" })).toBeVisible();
  await expect(dialog.getByText("Create a free account to ask questions")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Ask a question" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Send" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Create a free account" })).toBeVisible();
  expect(api.getRequests).toBe(0);
  expect(api.statusRequests).toBe(0);

  const lessonUrl = page.url();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(page.url()).toBe(lessonUrl);
});
