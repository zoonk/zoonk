import { engineModeFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { expectCount, openActivity } from "../_test-utils/activity-player";

const instrument = vi.hoisted(() => () => ({ ready: Promise.reject(new Error("offline")) }));

vi.mock("smplr", () => ({ Soundfont: instrument, SplendidGrandPiano: instrument }));

describe("music activities without sound", () => {
  it("keyboard by ear: a sound that can't load shows its notes at once", async () => {
    openActivity({
      content: engineModeFixtures.keyboardFretboard.byEar,
      template: "keyboardFretboard",
    });

    await expect.element(page.getByText("The sound plays: C, G").first()).toBeVisible();
    await expectCount(page.getByRole("button", { name: "I can't listen now" }), 0);
  });
});
