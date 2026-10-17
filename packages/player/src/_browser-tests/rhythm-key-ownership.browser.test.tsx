import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { focusOn } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";

function openRhythm() {
  localStorage.removeItem("zoonk:rhythm-device-delay");

  renderLessonPlayer({
    children: (
      <>
        <LessonPlayerShell />
        <label>
          Buddy question
          <input />
        </label>
        <div role="dialog" aria-label="Popup">
          <button type="button">Popup action</button>
        </div>
      </>
    ),
    lesson: buildLesson([activityStep({ content: activityContentFixtures.rhythmTapper })]),
  });
}

function space(target: EventTarget, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: " ",
    ...options,
  });

  target.dispatchEvent(event);
  return event;
}

describe("rhythm key ownership", () => {
  afterEach(() => localStorage.removeItem("zoonk:rhythm-device-delay"));

  it("lets the learner type spaces in the buddy during the sound check", async () => {
    openRhythm();
    await page.getByRole("button", { name: "Start the sound check" }).click();
    const buddy = page.getByRole("textbox", { name: "Buddy question" });
    await focusOn(buddy);
    await userEvent.keyboard("two words");
    await expect.element(buddy).toHaveValue("two words");
    expect(space(globalThis).defaultPrevented).toBe(false);
  });

  it("leaves Space to popup controls and handled or modified keys, while the pad keeps Space", async () => {
    openRhythm();
    await page.getByRole("button", { name: "Start the sound check" }).click();
    const popup = page.getByRole("button", { name: "Popup action" });
    await focusOn(popup);
    expect(space(popup.element()).defaultPrevented).toBe(false);
    const pad = page.getByRole("button", { name: /Get ready/u });
    await focusOn(pad);
    expect(space(pad.element(), { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(space(pad.element(), { repeat: true }).defaultPrevented).toBe(false);
    expect(space(pad.element()).defaultPrevented).toBe(true);
  });
});
