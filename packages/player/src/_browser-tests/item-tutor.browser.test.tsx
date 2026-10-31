import { type TutorItem } from "@zoonk/learn/question-tutor";
import { TaskAside, TaskAsideContent, getTaskAsideRootProps } from "@zoonk/learn/task-layout";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { render } from "../_test-utils/render";
import { TUTOR_ANSWER, stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { getQuestionTutor } from "../questions/item-tutor";

const TUTOR = getQuestionTutor(buildTutor());

type RunQuestion = Pick<TutorItem, "itemId" | "text">;

const EVEN = { itemId: crypto.randomUUID(), text: "Which number is even?" };
const ODD = { itemId: crypto.randomUUID(), text: "Which number is odd?" };

function QuestionRun({ material, questions }: { material?: string; questions: RunQuestion[] }) {
  const [position, setPosition] = useState(0);
  const [answered, setAnswered] = useState(false);
  const question = questions[position];
  const root = getTaskAsideRootProps();

  const item = question
    ? { ...question, answered, blockId: null, missed: answered, position }
    : null;

  const next = () => {
    setPosition(position + 1);
    setAnswered(false);
  };

  return TUTOR.wrap(
    item,
    <div className={root.className} data-aside={root["data-aside"]}>
      {material && <TaskAsideContent>{material}</TaskAsideContent>}
      <p>{question?.text}</p>

      {answered ? (
        <button onClick={next} type="button">
          Continue
        </button>
      ) : (
        <button onClick={() => setAnswered(true)} type="button">
          Check
        </button>
      )}

      {TUTOR.button}

      <TaskAside label="About this question" meta={TUTOR.asideMeta(null)}>
        {TUTOR.aside}
      </TaskAside>
    </div>,
  );
}

function runAside() {
  return page.getByRole("complementary", { name: "About this question" });
}

function composer() {
  return runAside().getByRole("textbox", { name: /^Ask Pip about /u });
}

function dockedConversation() {
  return page.getByRole("region", { name: "Questions to Pip" });
}

async function askFromAside(question: string) {
  await composer().fill(question);
  await press("Enter");
}

const WHY_MISSED = "Why isn't it 7?";

const SHARED_TEXT = "Numbers that end in 0, 2, 4, 6 or 8 are even; the others are odd.";

async function missAndAskWhy() {
  await page.getByRole("button", { name: "Check" }).click();
  await askFromAside(WHY_MISSED);
  await expect.element(dockedConversation().getByText(TUTOR_ANSWER)).toBeVisible();
}

function earlierDayTurns(api: ReturnType<typeof stubTutorApi>) {
  return [
    {
      ...api.question({
        answer: "Think about the last digit.",
        question: "Any hint?",
        status: "completed",
      }),
      context: { answered: false, kind: "item" as const },
    },
    {
      ...api.question({
        answer: "8 is even: it ends in 8.",
        question: WHY_MISSED,
        status: "completed",
      }),
      context: { answered: true, kind: "item" as const },
    },
  ];
}

describe("the buddy beside a run of questions", () => {
  it("answers a question typed in the aside before the question is checked", async () => {
    const api = stubTutorApi({});
    render(<QuestionRun questions={[EVEN]} />);

    await askFromAside("Any hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText("Any hint?")).toBeVisible();
    await expect.element(conversation.getByText(TUTOR_ANSWER)).toBeVisible();
    expect(api.inputs).toMatchObject([{ context: { answered: false, kind: "item" } }]);
  });

  it("names the composer for what the learner asks about: the question, then their answer", async () => {
    stubTutorApi({});
    render(<QuestionRun questions={[EVEN]} />);

    await expect
      .element(runAside().getByRole("textbox", { name: "Ask Pip about this question" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Check" }).click();

    await expect
      .element(runAside().getByRole("textbox", { name: "Ask Pip about your answer" }))
      .toBeVisible();
  });

  it("opens a question asked again later in the run fresh, its conversation a tap away", async () => {
    stubTutorApi({});
    render(<QuestionRun questions={[EVEN, ODD, EVEN]} />);
    await missAndAskWhy();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect.element(page.getByText(ODD.text)).toBeVisible();
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect.element(page.getByText(EVEN.text)).toBeVisible();
    await expect.element(dockedConversation()).not.toBeInTheDocument();
    await expect.element(composer()).not.toHaveFocus();

    await askFromAside("Any hint?");
    await expect.element(dockedConversation().getByText("Any hint?")).toBeVisible();
  });

  it("keeps what the buddy said about an earlier answer out until the question is checked again", async () => {
    const api = stubTutorApi({});
    render(<QuestionRun questions={[EVEN, ODD, EVEN]} />);
    await missAndAskWhy();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await askFromAside("Any hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText("Any hint?")).toBeVisible();
    await expect.element(conversation.getByText(WHY_MISSED)).not.toBeInTheDocument();
    expect(api.inputs[1]).toMatchObject({ context: { answered: false, kind: "item" } });

    await page.getByRole("button", { name: "Check" }).click();
    await expect.element(conversation.getByText(WHY_MISSED)).toBeVisible();
  });

  it("keeps an answer read again after its stream broke out of the question asked again", async () => {
    const api = stubTutorApi({});

    api.next("answer", () => {
      api.complete(api.questions.at(-1)?.id ?? "");
      return Promise.resolve(new Response(null, { status: 500 }));
    });

    render(<QuestionRun questions={[EVEN, ODD, EVEN]} />);
    await missAndAskWhy();
    expect(api.requests.question).toBe(1);

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect.poll(() => api.requests.thread).toBe(2);
    const release = api.hold("thread");
    await askFromAside("Any hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText("Any hint?")).toBeVisible();
    await expect.element(conversation.getByText(WHY_MISSED)).not.toBeInTheDocument();
    await release();
  });

  it("keeps an earlier day's talk about the answer out of a question practiced again", async () => {
    const api = stubTutorApi({});
    api.questions = earlierDayTurns(api);

    render(<QuestionRun questions={[EVEN]} />);
    await askFromAside("Another hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText("Another hint?")).toBeVisible();
    await expect.element(conversation.getByText("Think about the last digit.")).toBeVisible();

    await expect
      .element(conversation.getByText("8 is even: it ends in 8."))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: "Check" }).click();
    await expect.element(conversation.getByText("8 is even: it ends in 8.")).toBeVisible();
    await expect.element(conversation.getByText("About your answer")).toBeVisible();
  });

  it("leads back to the question's conversation from the aside's header", async () => {
    stubTutorApi({});
    render(<QuestionRun questions={[EVEN]} />);
    await missAndAskWhy();

    await dockedConversation().getByRole("button", { name: "Back" }).click();
    await expect.element(dockedConversation()).not.toBeInTheDocument();

    const conversationLink = runAside().getByRole("button", { name: "1 question" });
    await expect.element(conversationLink).toBeVisible();
    await conversationLink.click();
    await expect.element(dockedConversation().getByText(TUTOR_ANSWER)).toBeVisible();
  });

  it("docks the conversation over the question's shared text, which comes back after", async () => {
    stubTutorApi({});
    render(<QuestionRun material={SHARED_TEXT} questions={[EVEN]} />);

    const material = page.getByText(SHARED_TEXT);
    await expect.element(material).toBeVisible();

    await askFromAside("Any hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(material).not.toBeVisible();

    await conversation.getByRole("button", { name: "Back" }).click();
    await expect.element(material).toBeVisible();
  });
});
