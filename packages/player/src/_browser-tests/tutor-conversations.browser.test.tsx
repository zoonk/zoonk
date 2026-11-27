import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";
import { stubTutorApi, tutorAnswerStream } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { TutorConversation } from "../questions/tutor-conversation";
import { type LessonQuestionThreadPage } from "../questions/use-lesson-question-sessions";

const NEW_ID = "01a11014-0000-7000-8000-0000000000c1";

const EARLIER_ID = "01a11014-0000-7000-8000-0000000000c2";

const NOTHING_ASKED: LessonQuestionThreadPage = { hasMore: false, nextCursor: null, questions: [] };

/**
 * Stands for the buddy's page: its list opens a conversation, and the page hands over what it read
 * of that one. `earlier` is what it read of the earlier conversation.
 */
function TwoConversations({ earlier }: { earlier: LessonQuestionThreadPage }) {
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
        thread={openId === NEW_ID ? NOTHING_ASKED : earlier}
        tutor={buildTutor()}
      />
    </>
  );
}

function composer() {
  return page.getByRole("textbox", { name: "Message Zu" });
}

async function ask(question: string) {
  await expect.element(composer()).toBeEnabled();
  await composer().fill(question);
  await userEvent.keyboard("{Enter}");
}

describe("the buddy's conversations", () => {
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
});
