import {
  QuestionActions,
  QuestionDontKnow,
  QuestionMainAction,
} from "@zoonk/learn/question-actions";
import { TaskActionBar } from "@zoonk/learn/task-layout";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { render } from "../_test-utils/render";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { getQuestionTutor } from "../questions/item-tutor";

const TUTOR = getQuestionTutor(buildTutor());

const ITEM = {
  answered: false,
  blockId: null,
  itemId: crypto.randomUUID(),
  missed: false,
  position: 0,
  text: "Which number is even?",
};

function openBar({ dontKnow, main }: { dontKnow: string; main: string }) {
  stubTutorApi({});

  render(
    TUTOR.wrap(
      ITEM,
      <main className="flex min-h-dvh flex-col justify-end">
        <TaskActionBar>
          <QuestionActions>
            <QuestionDontKnow onPress={() => {}}>{dontKnow}</QuestionDontKnow>
            <QuestionMainAction action="check">{main}</QuestionMainAction>
            {TUTOR.button}
          </QuestionActions>
        </TaskActionBar>
      </main>,
    ),
  );
}

function top(element: Element | null | undefined) {
  return element?.getBoundingClientRect().top;
}

function lines(main: string) {
  const ask = page.getByRole("button", { name: "Ask Pip" }).element();
  const dontKnow = document.querySelector("[data-slot=question-dont-know]");
  const action = page.getByRole("button", { name: main }).element();

  return {
    ask: top(ask) === top(action) ? "beside the main action" : "on its own line",
    dontKnow: top(dontKnow) === top(action) ? "beside the main action" : "above the main action",
    mainIsSmaller:
      top(dontKnow) === top(action) &&
      action.getBoundingClientRect().width < (dontKnow?.getBoundingClientRect().width ?? 0),
  };
}

describe("a question's bar on a phone", () => {
  it("keeps one line while the main action is no smaller than the answer beside it", async () => {
    await atViewport({ height: 700, width: 390 }, async () => {
      openBar({ dontKnow: "I don't know yet", main: "Check" });

      await expect
        .poll(() => lines("Check"))
        .toStrictEqual({
          ask: "beside the main action",
          dontKnow: "beside the main action",
          mainIsSmaller: false,
        });
    });
  });

  it.each([
    { dontKnow: "I don't know yet", main: "Check", width: 340 },
    { dontKnow: "Ich weiß es noch nicht", main: "Weiter", width: 360 },
    { dontKnow: "Ich weiß es noch nicht", main: "Weiter", width: 390 },
  ])(
    "moves “$dontKnow” to the line above rather than squeezing the main action or leaving the ask alone, $width px wide",
    async ({ dontKnow, main, width }) => {
      await atViewport({ height: 700, width }, async () => {
        openBar({ dontKnow, main });

        await expect
          .poll(() => lines(main))
          .toStrictEqual({
            ask: "beside the main action",
            dontKnow: "above the main action",
            mainIsSmaller: false,
          });
      });
    },
  );
});
