import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, page } from "vitest/browser";
import { allowMicrophone } from "../_test-utils/microphone";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { holdFinger, liftFinger } from "../_test-utils/touch-screen";
import { buildLesson } from "../preview/preview-lesson";
import { spokenAnswerStep } from "../preview/preview-steps";

describe("recording by touch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("discards a two-finger gesture and keeps the fresh take through the next tap", async () => {
    vi.spyOn(navigator.permissions, "query").mockResolvedValue({
      state: "granted",
    } as PermissionStatus);

    const microphone = allowMicrophone();
    const lesson = buildLesson([spokenAnswerStep()]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { gradeSpokenAnswer: async () => ({ status: "noSpeech" }) }),
      lesson,
    });

    const record = page.getByRole("button", { exact: true, name: "Record" });
    // Chromium needs a completed gesture to run the Web Audio microphone fixture.
    await page.getByRole("heading", { name: "The electron is a cloud" }).click();
    const first = await holdFinger(record);
    const [opened] = microphone.mock.results;

    if (opened?.type !== "return") {
      throw new Error("The first press did not open a microphone");
    }

    const stream = await opened.value;
    const other = { x: first.x, y: first.y - 100 };

    await commands.touch([
      { touchPoints: [first, other], type: "touchStart" },
      { touchPoints: [other], type: "touchEnd" },
      { touchPoints: [], type: "touchEnd" },
    ]);

    await expect.poll(() => stream.getTracks()[0]?.readyState).toBe("ended");
    await holdFinger(record);
    await expect.poll(() => microphone.mock.calls.length).toBe(2);
    await liftFinger();
    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();
    expect(microphone).toHaveBeenCalledTimes(2);
  });
});
