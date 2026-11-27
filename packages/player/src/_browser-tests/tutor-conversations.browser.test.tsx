import { type ReactNode, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";
import { stubTutorApi, tutorAnswerStream } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { TutorConversationHost, TutorConversationLog } from "../questions/tutor-conversation";

const GOAL_ID = "01a11014-0000-7000-8000-00000000000a";

const NEW_ID = "01a11014-0000-7000-8000-0000000000c1";

const EARLIER_ID = "01a11014-0000-7000-8000-0000000000c2";

const ZU = { avatar: null, figure: null, name: "Zu" };

const NOTHING_ASKED = { hasMore: false, nextCursor: null, questions: [] };

type Open = { blank: boolean; id: string };

function Log({ conversationId }: { conversationId?: string }) {
  return (
    <TutorConversationLog
      conversationId={conversationId}
      greeting="Hi! I'm Zu."
      identity={ZU}
      renderPlanChange={() => null}
      renderToolOffer={() => null}
      thread={NOTHING_ASKED}
    />
  );
}

function Host({ children, conversation }: { children: ReactNode; conversation: Open }) {
  return (
    <TutorConversationHost
      composerLabel="Message Zu"
      conversation={conversation}
      goalId={GOAL_ID}
      identity={ZU}
      placeholder="Message Zu"
      suggestions={[]}
      tutor={buildTutor()}
    >
      {children}
    </TutorConversationHost>
  );
}

/** Stands for the buddy's page: the list opens a conversation, and each has its own page. */
function TwoConversations() {
  const [open, setOpen] = useState<Open>({ blank: true, id: NEW_ID });

  return (
    <>
      <button onClick={() => setOpen({ blank: true, id: NEW_ID })} type="button">
        Open the new one
      </button>
      <button onClick={() => setOpen({ blank: false, id: EARLIER_ID })} type="button">
        Open the earlier one
      </button>
      <Host conversation={open}>
        {open.blank ? <Log key="new" /> : <Log conversationId={open.id} key={open.id} />}
      </Host>
    </>
  );
}

const ADDRESS_NAMES_IT = "address-names-it";

/**
 * Stands for the address naming a blank conversation once it's sent: its page is another one. The
 * app does that on its own, so nothing here is clicked, which would move focus.
 */
function ConversationGetsItsPage() {
  const [named, setNamed] = useState(false);

  useEffect(() => {
    const name = () => setNamed(true);
    globalThis.addEventListener(ADDRESS_NAMES_IT, name);
    return () => globalThis.removeEventListener(ADDRESS_NAMES_IT, name);
  }, []);

  return (
    <>
      <p>{named ? "Its own page" : "The blank page"}</p>
      <Host conversation={{ blank: !named, id: NEW_ID }}>
        {named ? <Log conversationId={NEW_ID} key="named" /> : <Log key="blank" />}
      </Host>
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

    render(<TwoConversations />);
    await ask("Why is the sky blue?");

    stream.write("Sunlight scatters");
    await expect.element(page.getByText("Sunlight scatters")).toBeVisible();

    await page.getByRole("button", { name: "Open the earlier one" }).click();
    await expect.element(composer()).toBeEnabled();
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

    expect(api.requests.thread).toBe(0);
  });

  it("keeps what the learner typed, and a question that didn't go through, with the conversation it was for", async () => {
    const api = stubTutorApi({});

    render(<TwoConversations />);
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

  it("keeps a new conversation's turns, its answer on its way and the composer's focus when its own page takes over", async () => {
    const api = stubTutorApi({});
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    render(<ConversationGetsItsPage />);
    await ask("Why is the sky blue?");
    stream.write("Sunlight scatters");
    await expect.element(page.getByText("Sunlight scatters")).toBeVisible();
    await composer().fill("And at sunset?");

    globalThis.dispatchEvent(new Event(ADDRESS_NAMES_IT));
    await expect.element(page.getByText("Its own page")).toBeVisible();

    await expect.element(page.getByText("Why is the sky blue?")).toBeVisible();
    await expect.element(composer()).toHaveValue("And at sunset?");
    await expect.element(composer()).toHaveFocus();

    stream.write(" off the air.");
    stream.finish();
    stream.close();

    await expect.element(page.getByText("Sunlight scatters off the air.")).toBeVisible();
    expect(api.requests.thread).toBe(0);
  });
});
