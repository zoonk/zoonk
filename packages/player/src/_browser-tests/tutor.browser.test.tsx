import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { MemoryUpdated } from "@zoonk/learn/memory-updated";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { expectCount, focusOn, press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { teachingStep } from "../_test-utils/lesson-steps";
import { buildLesson, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import {
  TUTOR_ANSWER,
  buildTutor,
  stubTutorApi,
  tutorAnswerResponse,
  tutorAnswerStream,
} from "../_test-utils/tutor-api";
import { type PlayableLibraryStep } from "../lesson/lesson-player-types";
import { type LessonQuestionNavigation } from "../questions/lesson-question-navigation";

/**
 * The tutor in a lesson ("Ask a question"): its sheet asks about the screen in view or the answer
 * just checked, streams answers, and keeps each screen's thread in step with the API as answers
 * finish elsewhere, requests fail or responses arrive late. The API is faked at the tutor's
 * connection (`stubTutorApi`).
 */

const PHONE = { height: 812, width: 375 };

/** The first poll for an answer still being written comes within 1.2 s (1 s, give or take 20%). */
const FIRST_POLL_MS = 1200;

/** The next one comes within 2.4 s of that. */
const SECOND_POLL_MS = 2400;

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

/** A lesson whose tutor reaches a fresh fake API; tests save questions on it before it opens. */
function lessonWithTutor({
  pageSize,
  steps = [teachingStep("check")],
}: { pageSize?: number; steps?: PlayableLibraryStep[] } = {}) {
  const lesson = buildLesson(steps);
  return { api: stubTutorApi({ lesson, pageSize }), lesson };
}

function playLesson({
  lesson,
  navigation,
}: {
  lesson: ReturnType<typeof buildLesson>;
  navigation?: Partial<LessonQuestionNavigation>;
}) {
  renderLessonPlayer({ lesson, tutor: buildTutor(navigation) });
}

async function openTutor() {
  await page.getByRole("button", { name: "Ask a question" }).click();
  const sheet = page.getByRole("dialog");
  await expect.element(sheet.getByRole("heading", { name: "Ask questions" })).toBeVisible();
  return sheet;
}

function composer(sheet: Locator) {
  return sheet.getByRole("textbox", { name: "Ask a question" });
}

function sendButton(sheet: Locator) {
  return sheet.getByRole("button", { name: "Send" });
}

async function ask(sheet: Locator, question: string) {
  await composer(sheet).fill(question);
  await sendButton(sheet).click();
}

/**
 * Polls wait on timers. A frozen clock moves only when the test moves it, so each poll comes
 * exactly when the test says.
 */
function freezeClock() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** What a dropped connection does to `fetch`: the request may have reached the server. */
function connectionLost() {
  return new TypeError("Failed to fetch");
}

/** How far the thread is scrolled from its end. */
function distanceFromBottom(log: Locator) {
  const element = log.element();
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

describe("asking the tutor", () => {
  it("keeps a late history preload in its own step and restores it on return", async () => {
    const { api, lesson } = lessonWithTutor({
      steps: [teachingStep("explanation"), teachingStep("explanation")],
    });

    const first = api.question({
      answer: "First part answer",
      question: "First part question",
      status: "completed",
    });

    const second = api.question({
      answer: "Second part answer",
      question: "Second part question",
      status: "completed",
      step: 1,
    });

    api.questions = [first, second];
    const releasePreload = api.hold("thread");
    playLesson({ lesson });

    await expect.poll(() => api.requests.thread).toBe(1);
    await page.getByRole("button", { name: /^Next/u }).click();
    const sheet = await openTutor();
    await expect.element(sheet.getByText(second.question)).toBeVisible();

    await releasePreload();
    await expect.element(sheet.getByText(first.question)).not.toBeInTheDocument();

    // The arrows stay in the sheet while it's open; once it closes they move the lesson.
    await focusOn(sheet.getByRole("button", { name: "Close questions" }));
    await press("ArrowLeft");
    await expect.element(sheet.getByText("Part 2 of 2")).toBeVisible();
    await press("Escape");
    await expect.element(sheet).not.toBeInTheDocument();
    await press("ArrowLeft");

    await expect
      .element(page.getByRole("button", { name: "Previous screen" }))
      .not.toBeInTheDocument();

    await openTutor();
    await expect.element(sheet.getByText(first.question)).toBeVisible();
    await expect.element(sheet.getByText(second.question)).not.toBeInTheDocument();
    expect(api.requests.thread).toBe(2);
  });

  it("asks about the answer just checked, with that answer as context", async () => {
    const { api, lesson } = lessonWithTutor();
    const [check] = lesson.steps;
    playLesson({ lesson });

    await page.getByRole("radio", { name: "The electron's size" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .element(
        page.getByText("The cloud is far bigger than the electron. It maps chances, not size."),
      )
      .toBeVisible();

    await expectAccessibleScreen("check answered wrong");
    expect(api.inputs).toHaveLength(0);

    const sheet = await openTutor();
    await ask(sheet, "Why isn't it this one?");
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    await expectAccessibleScreen("tutor about an answer");

    expect(api.inputs[0]).toMatchObject({
      context: {
        answer: { kind: "check", optionId: "size" },
        kind: "answer",
        stepId: check?.id,
        stepNumber: 1,
      },
      question: "Why isn't it this one?",
    });
  });

  it("recovers a lost question before sending a follow-up typed while it waited", async () => {
    const { api, lesson } = lessonWithTutor();
    const connectionDrops = Promise.withResolvers<null>();
    const followUp = "How does that connect to free fall?";

    // The question is saved, then the connection drops before its response arrives.
    api.next("create", async (serve) => {
      await serve();
      await connectionDrops.promise;
      throw connectionLost();
    });

    playLesson({ lesson });
    const sheet = await openTutor();
    const textbox = composer(sheet);
    const retry = sheet.getByRole("button", { name: "Retry last question" });

    await ask(sheet, "Can you explain the orbit again?");
    await expect.poll(() => api.questions).toHaveLength(1);
    await textbox.fill(followUp);
    connectionDrops.resolve(null);

    await expect
      .element(sheet.getByRole("alert"))
      .toHaveTextContent("We couldn't send your last question. Try again.");

    await expect.element(textbox).toHaveValue(followUp);
    await expect.element(retry).toBeVisible();
    expect(api.questions).toHaveLength(1);

    await retry.click();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(textbox).toHaveValue(followUp);
    expect(api.inputs).toHaveLength(2);
    expect(api.inputs[1]?.requestId).toBe(api.inputs[0]?.requestId);
    expect(api.questions).toHaveLength(1);
    expect(api.requests.answer).toBe(1);

    await sendButton(sheet).click();
    await expectCount(sheet.getByText(TUTOR_ANSWER), 2);
    expect(api.inputs).toHaveLength(3);
    expect(api.inputs[2]?.requestId).not.toBe(api.inputs[0]?.requestId);
    expect(api.questions).toHaveLength(2);
  });

  it("keeps an answer finished elsewhere when a lost question is sent again", async () => {
    const { api, lesson } = lessonWithTutor();

    api.next("create", async (serve) => {
      await serve();
      throw connectionLost();
    });

    playLesson({ lesson });
    const sheet = await openTutor();
    const retry = sheet.getByRole("button", { name: "Retry last question" });
    await ask(sheet, "Explain this replay.");
    await expect.element(retry).toBeVisible();

    // Meanwhile another session answered the question that was saved.
    const [saved] = api.questions;
    api.complete(saved?.id ?? "");

    await retry.click();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.questions).toHaveLength(1);
    expect(api.requests.answer).toBe(0);
  });

  it.each([
    { action: "Sign in", status: 401 },
    { action: "View plans", status: 402 },
  ])("offers $action when the API refuses a question with $status", async ({ action, status }) => {
    const { api, lesson } = lessonWithTutor();
    api.fail("create", status);
    playLesson({ lesson });

    const sheet = await openTutor();
    await ask(sheet, "Can I ask this?");
    await expect.element(sheet.getByRole("alert")).toBeVisible();
    await expect.element(sheet.getByRole("link", { name: action })).toBeVisible();

    await composer(sheet).click();
    await press("Enter");
    expect(api.requests.create).toBe(1);
  });

  it("offers plans and stops sending once a free learner's daily allowance is used", async () => {
    const { api, lesson } = lessonWithTutor();

    api.next("answer", () => {
      api.questions = api.questions.map((question) => ({ ...question, status: "failed" as const }));

      return Promise.resolve(
        Response.json(
          {
            error: {
              code: LESSON_PLAYER_ERROR_CODES.usageLimitReached,
              details: {
                limit: { limit: 10, period: "day", resource: "tutorMessage", tier: "free" },
              },
              message: "This plan's limit is reached",
            },
          },
          { status: 402 },
        ),
      );
    });

    playLesson({ lesson });
    const sheet = await openTutor();
    const limitReached = sheet.getByText(/asked all of today's questions/iu);
    const viewPlans = sheet.getByRole("link", { name: "View plans" });

    await ask(sheet, "Explain this within my limit.");
    await expect.element(limitReached).toBeVisible();
    await expect.element(viewPlans).toBeVisible();
    await expect.element(sheet.getByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(api.requests.answer).toBe(1);

    await composer(sheet).fill("A question for tomorrow.");
    await expect.element(sendButton(sheet)).toBeDisabled();

    await press("Escape");
    await openTutor();
    await expect.element(limitReached).toBeVisible();
    await expect.element(viewPlans).toBeVisible();
    await expect.element(sendButton(sheet)).toBeDisabled();
    expect(api.requests.answer).toBe(1);
  });

  it("answers a question another client left unfinished when this one conflicts with it", async () => {
    const { api, lesson } = lessonWithTutor();

    const remote = api.question({
      question: "A question started in another client.",
      status: "pending",
    });

    api.next("create", () => {
      api.questions = [...api.questions, remote];

      return Promise.resolve(
        Response.json({ error: "An unfinished question already exists" }, { status: 409 }),
      );
    });

    playLesson({ lesson });
    const sheet = await openTutor();
    await ask(sheet, "A local question waiting its turn.");

    await expect.element(sheet.getByText(remote.question)).toBeVisible();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(composer(sheet)).toHaveValue("A local question waiting its turn.");
    expect(api.requests.create).toBe(1);
    expect(api.requests.answer).toBe(1);
  });

  it("holds a new question until a failed answer is retried", async () => {
    const { api, lesson } = lessonWithTutor();

    api.questions = [
      api.question({ question: "Please retry this answer before my follow-up.", status: "failed" }),
    ];

    playLesson({ lesson });
    const sheet = await openTutor();
    await composer(sheet).fill("A follow-up question.");
    await expect.element(sendButton(sheet)).toBeDisabled();

    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect.element(sendButton(sheet)).toBeEnabled();
    await sendButton(sheet).click();

    await expectCount(sheet.getByText(TUTOR_ANSWER), 2);
    expect(api.requests.answer).toBe(2);
  });
});

describe("tutor answers", () => {
  it("renders a streamed answer as Markdown while it arrives", async () => {
    const { api, lesson } = lessonWithTutor();
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));
    playLesson({ lesson });

    const sheet = await openTutor();
    await ask(sheet, "Explain the orbit.");
    stream.write("### Key idea\n\n");

    await expect.element(sheet.getByRole("heading", { level: 3, name: "Key idea" })).toBeVisible();
    await expect.element(sheet.getByText("AI tutor")).toBeVisible();
    await expect.element(sheet.getByText("Thinking…")).not.toBeInTheDocument();

    stream.write(FORMATTED_ANSWER.slice("### Key idea\n\n".length));
    stream.finish();
    stream.close();

    await expectCount(sheet.getByRole("listitem"), 5);
    await expect.element(sheet.getByRole("button", { name: "Velocity" })).toBeVisible();

    await expect
      .element(sheet.getByRole("blockquote").getByText("continuous free fall"))
      .toBeVisible();

    await expect.element(sheet.getByText("const orbitalSpeed = 7.8;")).toBeVisible();

    await expect
      .poll(() => sheet.getByRole("code").filter({ hasText: "const orbitalSpeed" }).element())
      .toHaveProperty("innerText", expect.stringContaining(";\nconsole.log"));

    await expect
      .element(sheet.getByRole("table").getByRole("cell", { name: "km/s" }))
      .toBeVisible();

    await expectCount(sheet.getByRole("math"), 2);
    await expect.element(sheet.getByRole("document", { name: "How an orbit forms" })).toBeVisible();
  });

  it("is done once it's saved, and what memory learned follows", async () => {
    const { api, lesson } = lessonWithTutor();
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    playLesson({
      lesson,
      navigation: {
        renderMemoryUpdate: (changes) => <MemoryUpdated changes={changes} onUndo={vi.fn()} />,
      },
    });

    const sheet = await openTutor();
    const memoryUpdated = sheet.getByRole("status").filter({ hasText: "Memory updated:" });
    await ask(sheet, "Why doesn't it fall?");
    stream.write(TUTOR_ANSWER);
    stream.finish();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();

    // Memory is still learning from the exchange, and the learner can already ask again.
    await composer(sheet).fill("And the Moon?");
    await expect.element(sendButton(sheet)).toBeEnabled();
    await expect.element(memoryUpdated).not.toBeInTheDocument();

    stream.close([
      {
        action: "added",
        fact: { id: crypto.randomUUID(), statement: "Preparing for a pilot exam" },
        previous: null,
      },
    ]);

    await expect.element(memoryUpdated.getByText("Preparing for a pilot exam")).toBeVisible();
  });

  it("confirms an external link in an accessible dialog", async () => {
    const { api, lesson } = lessonWithTutor();

    api.next("answer", () =>
      Promise.resolve(
        tutorAnswerResponse("See [An outside example](https://example.com) for more."),
      ),
    );

    playLesson({ lesson });
    const sheet = await openTutor();
    await ask(sheet, "Explain with an outside source.");

    const link = sheet.getByRole("button", { name: "An outside example" });
    await link.click();

    const confirmation = page.getByRole("alertdialog", { name: "Open this link?" });
    const cancel = confirmation.getByRole("button", { name: "Cancel" });
    await expect.element(cancel).toHaveFocus();
    await press("Tab");
    await expect.element(confirmation.getByRole("link", { name: "Open link" })).toHaveFocus();
    await press("Tab");
    await expect.element(cancel).toHaveFocus();
    await press("Escape");
    await expect.element(confirmation).not.toBeInTheDocument();
    await expect.element(link).toHaveFocus();
  });

  it("leaves out images in a generated answer", async () => {
    const { api, lesson } = lessonWithTutor();
    const imageUrl = "https://tracking.example.test/pixel.png";

    api.next("answer", () =>
      Promise.resolve(tutorAnswerResponse(`### Safe answer\n\n![Tracking pixel](${imageUrl})`)),
    );

    playLesson({ lesson });
    const sheet = await openTutor();
    await ask(sheet, "Show a safe answer.");

    await expect
      .element(sheet.getByRole("heading", { level: 3, name: "Safe answer" }))
      .toBeVisible();

    await expect
      .element(sheet.getByRole("img", { name: "Tracking pixel" }))
      .not.toBeInTheDocument();

    expect(performance.getEntriesByName(imageUrl)).toHaveLength(0);
  });

  it("keeps a streamed answer in view while the learner follows the bottom", async () => {
    const { api, lesson } = lessonWithTutor();
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    api.questions = Array.from({ length: 8 }, (_, index) =>
      api.question({
        answer: `Saved explanation ${index}: ${TUTOR_ANSWER}`,
        question: `Saved question ${index}`,
        status: "completed",
      }),
    );

    playLesson({ lesson });
    const sheet = await openTutor();
    const log = sheet.getByRole("log", { name: "Questions about this lesson" });
    await ask(sheet, "Stream this answer.");

    for (const chunk of [
      "Starting the explanation. ",
      "This adds enough detail for the answer to grow naturally. ".repeat(25),
      "The next idea builds on the previous one. ".repeat(25),
      "STREAM_FINAL_TAIL",
    ]) {
      stream.write(chunk);
      // oxlint-disable-next-line no-await-in-loop -- Each part shows before the next arrives.
      await expect.poll(() => log.element().textContent).toContain(chunk.trim());
    }

    stream.finish();
    stream.close();
    await expect.poll(() => distanceFromBottom(log)).toBeLessThanOrEqual(48);
  });

  it("doesn't move a learner who scrolls up while an answer streams", async () => {
    await atViewport(PHONE, async () => {
      const { api, lesson } = lessonWithTutor();
      const stream = tutorAnswerStream();
      api.next("answer", () => Promise.resolve(stream.response));

      api.questions = Array.from({ length: 8 }, (_, index) =>
        api.question({
          answer: `Earlier explanation ${index}: ${TUTOR_ANSWER}`,
          question: `Earlier question ${index}`,
          status: "completed",
        }),
      );

      playLesson({ lesson });
      const sheet = await openTutor();
      const log = sheet.getByRole("log", { name: "Questions about this lesson" });
      await ask(sheet, "Let me read while this streams.");

      stream.write("STREAM_STARTED");
      await expect.poll(() => log.element().textContent).toContain("STREAM_STARTED");
      await userEvent.wheel(log, { delta: { y: -10_000 } });
      await expect.poll(() => log.element().scrollTop).toBe(0);

      for (const chunk of [
        " A deliberately long streamed explanation continues here.".repeat(30),
        "More grounded detail arrives after the learner scrolls away.".repeat(30),
        "STREAM_FINISHED",
      ]) {
        stream.write(chunk);
        // oxlint-disable-next-line no-await-in-loop -- Each part shows before the next arrives.
        await expect.poll(() => log.element().textContent).toContain(chunk.trim());
      }

      stream.finish();
      stream.close();
      expect(log.element().scrollTop).toBe(0);
    });
  });
});

describe("answers still being written", () => {
  it("resumes a question saved before its answer started", async () => {
    const { api, lesson } = lessonWithTutor();

    const pending = api.question({
      question: "Please resume this pending question.",
      status: "pending",
    });

    api.questions = [pending];
    playLesson({ lesson });

    const sheet = await openTutor();
    await expect.element(sheet.getByText(pending.question)).toBeVisible();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.requests.answer).toBe(1);
  });

  it("resumes a pending question again after it failed to reach the API", async () => {
    const { api, lesson } = lessonWithTutor();

    api.questions = [
      api.question({
        question: "Please resume me after the connection returns.",
        status: "pending",
      }),
    ];

    api.fail("answer", 503);
    api.fail("question", 503);
    playLesson({ lesson });

    const sheet = await openTutor();
    await expect.element(sheet.getByText("We couldn't finish this answer.")).toBeVisible();
    await press("Escape");
    await openTutor();

    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.requests.answer).toBe(2);
  });

  it("reconciles an answer that kept running after a reload", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "Please finish this running question.",
      status: "running",
    });

    api.questions = [running];

    // By the time the tutor checks, the answer has finished where it was being written.
    api.next("question", (serve) => {
      api.complete(running.id);
      return serve();
    });

    playLesson({ lesson });
    const sheet = await openTutor();
    await expect.element(sheet.getByText(running.question)).toBeVisible();
    await expect.element(sheet.getByRole("button", { name: "Check again" })).toBeVisible();

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.requests.thread).toBe(1);
    expect(api.requests.question).toBe(1);
  });

  it("recovers an abandoned answer when the learner checks again", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    api.questions = [
      api.question({ question: "Please recover this interrupted answer.", status: "running" }),
    ];

    playLesson({ lesson });
    const sheet = await openTutor();
    await composer(sheet).fill("My follow-up question.");
    await expect.element(sendButton(sheet)).toBeDisabled();

    // The API still says it's running; nothing is writing it, so the answer request takes it over.
    await sheet.getByRole("button", { name: "Check again" }).click();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(sendButton(sheet)).toBeEnabled();
    expect(api.questions).toHaveLength(1);
    expect(api.requests.answer).toBe(1);
  });

  it("keeps waiting when another session is still writing the answer", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "Please wait for my other session.",
      status: "running",
    });

    api.questions = [running];

    // The API turns away a second answer request while the first one is still being written.
    api.fail("answer", 409);

    playLesson({ lesson });
    const sheet = await openTutor();
    const checkAgain = sheet.getByRole("button", { name: "Check again" });
    await composer(sheet).fill("My follow-up question.");

    await checkAgain.click();
    await expect.poll(() => api.requests.answer).toBe(1);
    await expect.element(checkAgain).toBeEnabled();
    await expect.element(sheet.getByText("Thinking…")).toBeVisible();
    await expect.element(sheet.getByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await expect.element(sendButton(sheet)).toBeDisabled();
    expect(api.questions[0]?.status).toBe("running");

    api.complete(running.id);
    await checkAgain.click();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(sendButton(sheet)).toBeEnabled();
  });

  it("doesn't restart an answer when an older manual check arrives after a poll finished it", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "A question being answered elsewhere",
      status: "running",
    });

    api.questions = [running];
    playLesson({ lesson });

    const sheet = await openTutor();
    const releaseCheck = api.hold("question");
    await sheet.getByRole("button", { name: "Check again" }).click();
    await expect.poll(() => api.requests.question).toBe(1);

    // The answer finishes while the check is on its way, and the next poll brings it.
    api.complete(running.id);
    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();

    // The check's response, still saying "running", arrives last.
    await releaseCheck();
    expect(sheet.getByText("Thinking…").query()).toBeNull();
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.requests.question).toBe(2);
    expect(api.requests.answer).toBe(0);
  });

  it("keeps polling an answer after a failed check", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "Please keep checking this answer.",
      status: "running",
    });

    api.questions = [running];
    api.fail("question", 503);
    playLesson({ lesson });

    const sheet = await openTutor();
    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect.poll(() => api.requests.question).toBe(1);

    api.complete(running.id);
    await vi.advanceTimersByTimeAsync(SECOND_POLL_MS);
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.requests.thread).toBe(1);
    expect(api.requests.question).toBe(2);
  });

  it("pauses polling while the learner is offline", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "Please wait until the connection returns.",
      status: "running",
    });

    api.questions = [running];
    playLesson({ lesson });
    const sheet = await openTutor();
    await expect.element(sheet.getByText(running.question)).toBeVisible();

    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    onTestFinished(() => onLine.mockRestore());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.requests.question).toBe(0);

    api.complete(running.id);
    onLine.mockReturnValue(true);
    globalThis.dispatchEvent(new Event("online"));
    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.requests.question).toBe(1);
  });

  it("stops polling and offers sign-in when the session expires", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "Please stop checking after my session expires.",
      status: "running",
    });

    api.questions = [running];
    api.fail("question", 401);
    playLesson({ lesson });

    const sheet = await openTutor();
    await expect.element(sheet.getByText(running.question)).toBeVisible();
    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect.element(sheet.getByText(/session expired/iu)).toBeVisible();
    await expect.element(sheet.getByRole("link", { name: "Sign in" })).toBeVisible();

    await vi.advanceTimersByTimeAsync(5000);
    expect(api.requests.thread).toBe(1);
    expect(api.requests.question).toBe(1);
  });

  it("offers plans when a manual check loses access to questions", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    api.questions = [
      api.question({ question: "Please check this answer manually.", status: "running" }),
    ];

    api.fail("question", 402);
    playLesson({ lesson });

    const sheet = await openTutor();
    await sheet.getByRole("button", { name: "Check again" }).click();
    await expect.element(sheet.getByText("Subscribe to ask questions")).toBeVisible();
    await expect.element(sheet.getByRole("link", { name: "View plans" })).toBeVisible();
    expect(api.requests.answer).toBe(0);
    expect(api.requests.question).toBe(1);
  });

  it("checks an interrupted answer before retrying an older failure", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor();

    const running = api.question({
      question: "Please reclaim this interrupted question first.",
      status: "running",
    });

    api.questions = [
      api.question({ question: "Please retry this older failed question.", status: "failed" }),
      running,
    ];

    api.next("question", (serve) => {
      api.complete(running.id);
      return serve();
    });

    playLesson({ lesson });
    const sheet = await openTutor();
    const retry = sheet.getByRole("button", { name: "Try again" });

    await expect.element(retry).toBeDisabled();
    await sheet.getByRole("button", { name: "Check again" }).click();
    await expectCount(sheet.getByText(TUTOR_ANSWER), 1);
    await expect.element(retry).toBeEnabled();

    await retry.click();
    await expectCount(sheet.getByText(TUTOR_ANSWER), 2);
    expect(api.requests.answer).toBe(1);
    expect(api.requests.question).toBe(1);
  });
});

describe("tutor history", () => {
  it("refreshes saved questions whenever the sheet is reopened", async () => {
    const { api, lesson } = lessonWithTutor();

    const mine = api.question({
      answer: TUTOR_ANSWER,
      question: "A question from this tab.",
      status: "completed",
    });

    api.questions = [mine];
    playLesson({ lesson });
    const sheet = await openTutor();
    await expect.element(sheet.getByText(mine.question)).toBeVisible();
    await press("Escape");

    const remote = api.question({
      answer: "An answer created in another client.",
      question: "A question from another client.",
      status: "completed",
    });

    api.questions = [...api.questions, remote];
    await openTutor();
    await expect.element(sheet.getByText(remote.question)).toBeVisible();
    await expect.element(sheet.getByText(remote.answer ?? "")).toBeVisible();
    expect(api.requests.thread).toBe(2);
  });

  it("loads history again when the sheet first opens after its preload failed", async () => {
    const { api, lesson } = lessonWithTutor();

    const saved = api.question({
      answer: "The saved explanation is available again.",
      question: "Show my saved question after the connection recovers.",
      status: "completed",
    });

    api.questions = [saved];
    api.fail("thread", 503);
    playLesson({ lesson });
    await expect.poll(() => api.requests.thread).toBe(1);

    const sheet = await openTutor();
    await expect.element(sheet.getByText(saved.question)).toBeVisible();
    await expect.element(sheet.getByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(api.requests.thread).toBe(2);
  });

  it("announces the first history load", async () => {
    const { api, lesson } = lessonWithTutor();
    const releasePreload = api.hold("thread");
    playLesson({ lesson });

    const sheet = await openTutor();
    const loading = sheet.getByRole("status");
    await expect.element(loading).toBeVisible();
    await expect.element(loading).toHaveTextContent("Loading questions…");
    expect(api.requests.thread).toBe(1);

    await releasePreload();
    await expect.element(loading).not.toBeInTheDocument();
    await expect.element(sheet.getByText("What would you like help with?")).toBeVisible();
    expect(api.requests.thread).toBe(1);
  });

  it("keeps saved history in view but holds sending while it refreshes", async () => {
    const { api, lesson } = lessonWithTutor();

    const saved = api.question({
      answer: TUTOR_ANSWER,
      question: "A saved question remains visible while refreshing.",
      status: "completed",
    });

    api.questions = [saved];
    playLesson({ lesson });
    const sheet = await openTutor();
    await expect.element(sheet.getByText(saved.question)).toBeVisible();
    await press("Escape");

    const releaseRefresh = api.hold("thread");
    await openTutor();
    await expect.poll(() => api.requests.thread).toBe(2);
    await expect.element(sheet.getByText(saved.question)).toBeVisible();
    await composer(sheet).fill("Wait for the refresh.");
    await expect.element(sendButton(sheet)).toBeDisabled();

    await releaseRefresh();
    await expect.element(sendButton(sheet)).toBeEnabled();
  });

  it("ignores an older refresh that arrives after a newer one", async () => {
    const { api, lesson } = lessonWithTutor();

    const savedQuestion = (name: string) =>
      api.question({ answer: `${name} answer`, question: `${name} question`, status: "completed" });

    api.questions = [savedQuestion("Initial")];
    playLesson({ lesson });
    const sheet = await openTutor();
    const stale = sheet.getByText("Stale question");
    const newest = sheet.getByText("Newest question");
    await expect.element(sheet.getByText("Initial question")).toBeVisible();
    await press("Escape");

    api.questions = [savedQuestion("Stale")];
    const releaseStale = api.hold("thread");
    await openTutor();
    await expect.poll(() => api.requests.thread).toBe(2);
    await press("Escape");

    api.questions = [savedQuestion("Newest")];
    await openTutor();
    await expect.element(newest).toBeVisible();
    await expect.element(stale).not.toBeInTheDocument();

    await releaseStale();
    await expect.element(newest).toBeVisible();
    await expect.element(stale).not.toBeInTheDocument();
  });

  it("loads earlier questions without dropping the latest page", async () => {
    const { api, lesson } = lessonWithTutor({ pageSize: 2 });

    api.questions = ["Oldest", "Middle", "Latest"].map((name) =>
      api.question({
        answer: `${name} saved answer`,
        question: `${name} saved question`,
        status: "completed",
      }),
    );

    playLesson({ lesson });
    const sheet = await openTutor();
    const loadEarlier = sheet.getByRole("button", { name: "Load earlier questions" });
    const oldest = sheet.getByText("Oldest saved question", { exact: true });

    await expect.element(oldest).not.toBeInTheDocument();
    await expect.element(sheet.getByText("Middle saved question", { exact: true })).toBeVisible();
    await expect.element(sheet.getByText("Latest saved question", { exact: true })).toBeVisible();
    await loadEarlier.click();

    await expect.element(oldest).toBeVisible();
    await expect.element(sheet.getByText("Middle saved question", { exact: true })).toBeVisible();
    await expect.element(sheet.getByText("Latest saved question", { exact: true })).toBeVisible();
    await expect.element(loadEarlier).not.toBeInTheDocument();

    await press("Escape");
    const releaseRefresh = api.hold("thread");
    await openTutor();
    await releaseRefresh();
    expect(api.requests.thread).toBe(3);
    await expect.element(oldest).toBeVisible();
    await expect.element(loadEarlier).not.toBeInTheDocument();
  });

  it("ignores an earlier page that arrives after the latest page refreshed", async () => {
    const { api, lesson } = lessonWithTutor({ pageSize: 2 });

    api.questions = ["Old", "Middle", "Latest"].map((name) =>
      api.question({
        answer: `${name} question before refresh answer`,
        question: `${name} question before refresh`,
        status: "completed",
      }),
    );

    playLesson({ lesson });
    const sheet = await openTutor();
    const loadEarlier = sheet.getByRole("button", { name: "Load earlier questions" });
    const old = sheet.getByText("Old question before refresh", { exact: true });

    await expect
      .element(sheet.getByText("Middle question before refresh", { exact: true }))
      .toBeVisible();

    const releaseEarlier = api.hold("thread");
    await loadEarlier.click();
    await expect.poll(() => api.requests.thread).toBe(2);

    const latest = api.question({
      answer: "Latest question after refresh answer",
      question: "Latest question after refresh",
      status: "completed",
    });

    api.questions = [...api.questions, latest];
    await press("Escape");
    await openTutor();
    await expect.element(sheet.getByText(latest.question, { exact: true })).toBeVisible();

    await releaseEarlier();
    await expect.element(old).not.toBeInTheDocument();
    await expect.element(loadEarlier).toBeVisible();

    await loadEarlier.click();
    await expect.element(old).toBeVisible();

    await expect
      .element(sheet.getByText("Middle question before refresh", { exact: true }))
      .toBeVisible();

    await expect
      .element(sheet.getByText("Latest question before refresh", { exact: true }))
      .toBeVisible();

    await expect.element(sheet.getByText(latest.question, { exact: true })).toBeVisible();
  });

  it("keeps earlier history while the latest answer is reconciled", async () => {
    freezeClock();
    const { api, lesson } = lessonWithTutor({ pageSize: 1 });

    const older = api.question({
      answer: "An older saved answer.",
      question: "An older saved question.",
      status: "completed",
    });

    const running = api.question({
      question: "The latest answer is still running.",
      status: "running",
    });

    api.questions = [older, running];
    playLesson({ lesson });

    const sheet = await openTutor();
    await sheet.getByRole("button", { name: "Load earlier questions" }).click();
    await expect.element(sheet.getByText(older.question)).toBeVisible();

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect.poll(() => api.requests.question).toBe(1);
    api.complete(running.id);
    await vi.advanceTimersByTimeAsync(SECOND_POLL_MS);

    await expect.element(sheet.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(sheet.getByText(older.question)).toBeVisible();
    await expect.element(sheet.getByText(older.answer ?? "")).toBeVisible();
  });

  it("shows saved history on a phone without moving focus into the composer", async () => {
    await atViewport(PHONE, async () => {
      const { api, lesson } = lessonWithTutor({ steps: [teachingStep("explanation")] });

      const saved = api.question({
        answer: `https://example.test/${"answer".repeat(100)}`,
        question: `https://example.test/${"question".repeat(80)}`,
        status: "completed",
      });

      api.questions = [saved];
      playLesson({ lesson });
      const sheet = await openTutor();
      const title = sheet.getByRole("heading", { name: "Ask questions" });
      const close = sheet.getByRole("button", { name: "Close questions" });
      const log = sheet.getByRole("log", { name: "Questions about this lesson" });

      await expect.element(sheet.getByText(saved.question)).toBeVisible();
      await expect.element(sheet.getByText(saved.answer ?? "")).toBeVisible();
      await expect.element(close).toBeVisible();
      await expect.element(composer(sheet)).not.toHaveFocus();

      const [sheetBox, titleBox, closeBox, logBox] = [sheet, title, close, log].map((locator) =>
        locator.element().getBoundingClientRect(),
      );

      if (!sheetBox || !titleBox || !closeBox || !logBox) {
        throw new Error("The sheet's header and thread should be on screen");
      }

      expect(titleBox.width).toBeGreaterThan(80);
      expect(closeBox.right).toBeLessThanOrEqual(sheetBox.right);
      expect(logBox.top).toBeGreaterThanOrEqual(Math.max(titleBox.bottom, closeBox.bottom));
    });
  });
});
