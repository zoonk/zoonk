import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { allowMicrophone } from "../_test-utils/microphone";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { holdFinger, liftFinger } from "../_test-utils/touch-screen";
import { buildLesson } from "../preview/preview-lesson";
import { spokenAnswerStep } from "../preview/preview-steps";

describe("recording by touch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the microphone opened on touch through the click that follows lifting the finger", async () => {
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
    await holdFinger(record);
    await expect.poll(() => microphone.mock.calls.length).toBe(1);
    await liftFinger();
    await expect.element(page.getByRole("button", { name: /^Stop/u })).toBeVisible();
    expect(microphone).toHaveBeenCalledOnce();
  });
});
