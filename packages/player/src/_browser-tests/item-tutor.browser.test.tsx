import { render } from "@testing-library/react";
import { type TutorItem } from "@zoonk/learn/question-tutor";
import { TaskAside, TaskAsideContent, getTaskAsideRootProps } from "@zoonk/learn/task-layout";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { TUTOR_ANSWER, stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { ItemAskButton, ItemTutor } from "../questions/item-tutor";
import { ItemTutorAside } from "../questions/item-tutor-aside";

/**
 * The buddy in a run of questions (a session's block, mistakes practice), docked at the foot of
 * the run's aside from `lg`, the harness's own size. The API is faked at the tutor's connection
 * (`stubTutorApi`).
 */

const TUTOR = buildTutor();

/** A question of the item bank, as a run shows it. */
type RunQuestion = Pick<TutorItem, "itemId" | "text">;

const EVEN = { itemId: crypto.randomUUID(), text: "Which number is even?" };
const ODD = { itemId: crypto.randomUUID(), text: "Which number is odd?" };

/**
 * A run as a session's block and mistakes practice play it around the buddy: the buddy stays while
 * the question in view changes, Check grades it (a miss) and Continue moves on. Practice asks a
 * missed question again, in a later run or later in the same one. A question can share a text with
 * its set (`material`), read in the aside's body.
 */
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

  return (
    <ItemTutor item={item} tutor={TUTOR}>
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

        <ItemAskButton />

        <TaskAside label="About this question">
          <ItemTutorAside />
        </TaskAside>
      </div>
    </ItemTutor>
  );
}

function runAside() {
  return page.getByRole("complementary", { name: "About this question" });
}

function composer() {
  return runAside().getByRole("textbox", { name: "Ask a question" });
}

function dockedConversation() {
  return page.getByRole("region", { name: "Questions to Pip" });
}

async function askFromAside(question: string) {
  await composer().fill(question);
  await press("Enter");
}

const WHY_MISSED = "Why isn't it 7?";

/** A text the questions of a set share, as long ones are read beside them. */
const SHARED_TEXT = "Numbers that end in 0, 2, 4, 6 or 8 are even; the others are odd.";

/** Misses the question in view, then asks the buddy why from the aside's composer. */
async function missAndAskWhy() {
  await page.getByRole("button", { name: "Check" }).click();
  await askFromAside(WHY_MISSED);
  await expect.element(dockedConversation().getByText(TUTOR_ANSWER)).toBeVisible();
}

/** Yesterday's conversation about a question: a hint, then why the learner's answer was wrong. */
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

  // The answer's stream broke after the server saved it, so the buddy read the question again: it
  // still says it was about the learner's answer.
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

    // Asking opens the conversation again, which reads it again: until then, what it holds shows.
    await expect.poll(() => api.requests.thread).toBe(2);
    const release = api.hold("thread");
    await askFromAside("Any hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText("Any hint?")).toBeVisible();
    await expect.element(conversation.getByText(WHY_MISSED)).not.toBeInTheDocument();
    await release();
  });

  // Practice asks yesterday's missed question first: what the buddy said about the miss then waits
  // until today's answer is checked.
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

  // The conversation docks over the aside's body, where a question's shared text is read: the text
  // gives way while it's open (drawn over it, it showed through), and comes back after.
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

  // While apps deploy, the tutor can meet the API from before `include`: it reads the conversation
  // as that API sends it, holding nothing back as it did then, and the aside's composer still sends.
  it("talks with the API from before `include`, holding nothing back", async () => {
    const api = stubTutorApi({ olderApi: true });
    api.questions = earlierDayTurns(api);

    render(<QuestionRun questions={[EVEN]} />);
    await askFromAside("Another hint?");

    const conversation = dockedConversation();
    await expect.element(conversation.getByText(TUTOR_ANSWER)).toBeVisible();
    await expect.element(conversation.getByText("8 is even: it ends in 8.")).toBeVisible();
    expect(api.inputs).toMatchObject([{ context: { answered: false, kind: "item" } }]);
  });
});
