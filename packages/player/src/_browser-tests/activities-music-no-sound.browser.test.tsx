import { engineModeFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { expectCount, openActivity } from "../_test-utils/activity-player";

vi.mock("smplr", () => {
  const instrument = () => ({ ready: Promise.reject(new Error("offline")) });
  return { Soundfont: instrument, SplendidGrandPiano: instrument };
});

it("keyboard by ear: a sound that can't load shows its notes at once", async () => {
  openActivity({
    content: engineModeFixtures.keyboardFretboard.byEar,
    template: "keyboardFretboard",
  });
  await expect.element(page.getByText("The sound plays: C, G").first()).toBeVisible();
  await expectCount(page.getByRole("button", { name: "I can't listen now" }), 0);
});
