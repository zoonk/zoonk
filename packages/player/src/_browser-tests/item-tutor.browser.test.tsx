import { render } from "@testing-library/react";
import { type TutorItem } from "@zoonk/learn/question-tutor";
import { TaskAside, getTaskAsideRootProps } from "@zoonk/learn/task-layout";
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

/**
 * A run as a session's block and mistakes practice play it around the buddy: the buddy stays while
 * the question in view changes, Check grades it (a miss) and Continue moves on. Practice asks a
 * missed question again, in a later run or later in the same one.
 */
function QuestionRun({ questions }: { questions: RunQuestion[] }) {
  const [position, setPosition] = useState(0);
  const [answered, setAnswered] = useState(false);
  const question = questions[position];
  const root = getTaskAsideRootProps({ footer: false });

  const item = question ? { ...question, answered, blockId: null, missed: answered } : null;

  const next = () => {
    setPosition(position + 1);
    setAnswered(false);
  };

  return (
    <ItemTutor item={item} tutor={TUTOR}>
      <div className={root.className} data-aside={root["data-aside"]}>
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
});
