import { Toaster } from "@zoonk/ui/components/toast";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";
import { buildAdapters, lessonPlayerElement } from "../_test-utils/render-lesson-player";
import { type LessonPlayerProviderProps } from "../lesson/lesson-player-provider";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const FAILED = "Couldn't save this lesson. Try again.";
const RIGHT_OPTION = "Where the electron is most likely to be found";

/** The toasts' titles: with no styles loaded, they sit out of view. */
function toasts() {
  return [...document.querySelectorAll("[data-slot=toast-title]")].map(
    (title) => title.textContent,
  );
}

/** A one-question lesson whose save waits until the test fails it. */
function renderSavingLesson(slots?: LessonPlayerProviderProps["slots"]) {
  const lesson = buildLesson([teachingStep("check")]);
  const saving = Promise.withResolvers<boolean | null>();
  const saveLesson = vi.fn(() => saving.promise);

  const player = lessonPlayerElement({
    adapters: buildAdapters(lesson, { saveLesson }),
    lesson,
    slots,
  });

  const view = render(
    <>
      {player}
      <Toaster />
    </>,
    { reactStrictMode: true },
  );

  const leave = () =>
    view.rerender(
      <>
        {null}
        <Toaster />
      </>,
    );

  return { fail: () => saving.resolve(null), leave };
}

describe("the lesson's bookmark", () => {
  it("says a save failed while the learner is still on the lesson, its end included", async () => {
    const { fail } = renderSavingLesson({
      completion: () => <h2>Block done</h2>,
      completionHeader: ({ completion, menu }) =>
        completion.status === "saved" ? <header aria-label="Today">{menu}</header> : null,
    });

    await page.getByRole("button", { exact: true, name: "Save" }).click();
    await page.getByRole("radio", { name: RIGHT_OPTION }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Block done" })).toBeVisible();

    fail();

    await expect.poll(toasts).toContain(FAILED);
  });

  it("keeps quiet about a save that failed after the learner left the lesson", async () => {
    const { fail, leave } = renderSavingLesson();

    await page.getByRole("button", { exact: true, name: "Save" }).click();
    leave();
    fail();

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(toasts()).not.toContain(FAILED);
  });
});
