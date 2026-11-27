import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";
import { TUTOR_ANSWER, stubTutorApi, tutorAnswerStream } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { TutorConversation } from "../questions/tutor-conversation";
import { type LessonQuestionThreadPage } from "../questions/use-lesson-question-sessions";

const NEW_ID = "01a11014-0000-7000-8000-0000000000c1";

const EARLIER_ID = "01a11014-0000-7000-8000-0000000000c2";

const NOTHING_ASKED: LessonQuestionThreadPage = { hasMore: false, nextCursor: null, questions: [] };

/**
 * Stands for the buddy's page: its list opens a conversation, and the page hands over what it read
 * of that one.
 */
function TwoConversations({
  earlier,
  latest = NOTHING_ASKED,
}: {
  earlier: LessonQuestionThreadPage;
  latest?: LessonQuestionThreadPage;
}) {
  const [openId, setOpenId] = useState(NEW_ID);

  return (
    <>
      <button onClick={() => setOpenId(NEW_ID)} type="button">
        Open the new one
      </button>
      <button onClick={() => setOpenId(EARLIER_ID)} type="button">
        Open the earlier one
      </button>
      <TutorConversation
        composerLabel="Message Zu"
        conversationId={openId}
        goalId="01a11014-0000-7000-8000-00000000000a"
        greeting="Hi! I'm Zu."
        identity={{ avatar: null, figure: null, name: "Zu" }}
        placeholder="Message Zu"
        renderPlanChange={() => null}
        renderToolOffer={() => null}
        suggestions={[]}
        thread={openId === NEW_ID ? latest : earlier}
        tutor={buildTutor()}
      />
    </>
  );
}

function composer() {
  return page.getByRole("textbox", { name: "Message Zu" });
}

function topOf(text: string) {
  return page.getByText(text).element().getBoundingClientRect().top;
}

async function ask(question: string) {
  await expect.element(composer()).toBeEnabled();
  await composer().fill(question);
  await userEvent.keyboard("{Enter}");
}

describe("the buddy's conversations", () => {
  it("shows a fresh server page when returning without dropping earlier turns, a draft, or a streaming answer", async () => {
    const api = stubTutorApi({ pageSize: 1 });
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    const savedQuestion = (question: string) => ({
      ...api.question({ answer: "A saved answer.", question, status: "completed" }),
      context: { kind: "plan" as const },
    });

    const older = savedQuestion("An older question");
    const latest = savedQuestion("The latest question");
    const elsewhere = savedQuestion("A question from another tab");
    const firstPage = { hasMore: true, nextCursor: latest.id, questions: [latest] };
    api.questions = [older, latest];

    const view = render(<TwoConversations earlier={NOTHING_ASKED} latest={firstPage} />);
    const loadEarlier = page.getByRole("button", { name: "Load earlier messages" });
    await loadEarlier.click();
    await expect.element(page.getByText(older.question)).toBeVisible();

    await ask("A question I'm asking here");
    stream.write("The answer starts");
    await expect.element(page.getByText("The answer starts")).toBeVisible();
    await composer().fill("My next draft");

    await page.getByRole("button", { name: "Open the earlier one" }).click();
    const running = api.questions.at(-1);

    if (!running) {
      throw new Error("Expected a question with an answer in progress");
    }

    const freshPage = {
      ...firstPage,
      questions: [latest, elsewhere, { ...running, status: "running" as const }],
    };

    view.rerender(<TwoConversations earlier={NOTHING_ASKED} latest={freshPage} />);
    await page.getByRole("button", { name: "Open the new one" }).click();

    try {
      await expect.element(page.getByText(elsewhere.question)).toBeVisible();
      await expect.element(page.getByText(older.question)).toBeVisible();
      await expect.element(composer()).toHaveValue("My next draft");
      await expect.element(loadEarlier).not.toBeInTheDocument();
    } finally {
      stream.write(" and keeps going.");
      stream.finish();
      stream.close();
    }

    await expect.element(page.getByText("The answer starts and keeps going.")).toBeVisible();
    expect(api.requests.thread).toBe(1);
  });

  it("keeps an answer on its way in its own conversation while the learner opens another, and shows it when they come back", async () => {
    const api = stubTutorApi({});
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    const earlier = {
      ...NOTHING_ASKED,
      questions: [
        api.question({
          answer: "A share is a part.",
          question: "What is a share?",
          status: "completed",
        }),
      ],
    };

    render(<TwoConversations earlier={earlier} />);
    await ask("Why is the sky blue?");

    stream.write("Sunlight scatters");
    await expect.element(page.getByText("Sunlight scatters")).toBeVisible();

    await page.getByRole("button", { name: "Open the earlier one" }).click();
    await expect.element(page.getByText("A share is a part.")).toBeVisible();
    await expect.element(page.getByText("Why is the sky blue?")).not.toBeInTheDocument();
    await expect.element(page.getByText("Sunlight scatters")).not.toBeInTheDocument();

    stream.write(" off the air.");
    stream.finish();
    stream.close();

    await ask("What is a rainbow?");
    await expect.element(page.getByText("What is a rainbow?")).toBeVisible();
    await expect.element(page.getByText("Sunlight scatters off the air.")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Open the new one" }).click();
    await expect.element(page.getByText("Sunlight scatters off the air.")).toBeVisible();
    await expect.element(page.getByText("What is a rainbow?")).not.toBeInTheDocument();
    await expect.element(page.getByText("A share is a part.")).not.toBeInTheDocument();

    // Each conversation showed what its page read: nothing was read again from the browser.
    expect(api.requests.thread).toBe(0);
  });

  it("keeps what the learner typed, and a question that didn't go through, with the conversation it was for", async () => {
    const api = stubTutorApi({});

    render(<TwoConversations earlier={NOTHING_ASKED} />);
    await expect.element(composer()).toBeEnabled();
    await composer().fill("Half a thought");

    await page.getByRole("button", { name: "Open the earlier one" }).click();
    await expect.element(composer()).toHaveValue("");

    api.next("create", () => Promise.reject(new TypeError("Failed to fetch")));
    await ask("Why do I study fractions first?");

    const lost = page.getByRole("alert");
    await expect.element(lost).toHaveTextContent("We couldn't send your last question. Try again.");

    await page.getByRole("button", { name: "Open the new one" }).click();
    await expect.element(composer()).toHaveValue("Half a thought");
    await expect.element(lost).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Open the earlier one" }).click();
    await expect.element(composer()).toHaveValue("Why do I study fractions first?");
    await expect.element(lost).toBeVisible();
  });

  it("opens another conversation at its latest turn, even when it has no more turns than the one left", async () => {
    const api = stubTutorApi({});
    const longAnswer = `${TUTOR_ANSWER} `.repeat(30);

    const thread = (questions: string[]): LessonQuestionThreadPage => ({
      ...NOTHING_ASKED,
      questions: questions.map((question) =>
        api.question({ answer: longAnswer, question, status: "completed" }),
      ),
    });

    render(
      <TwoConversations
        earlier={thread(["What is a share?", "What is a bond?", "What is a fund?"])}
        latest={thread([
          "What is an orbit?",
          "Why don't satellites fall?",
          "What is escape velocity?",
        ])}
      />,
    );

    await expect.poll(() => topOf("What is escape velocity?")).toBeLessThan(window.innerHeight / 2);

    window.scrollTo({ top: 0 });
    await page.getByRole("button", { name: "Open the earlier one" }).click();

    await expect.poll(() => topOf("What is a fund?")).toBeLessThan(window.innerHeight / 2);
    expect(topOf("What is a fund?")).toBeGreaterThanOrEqual(0);
  });
});
