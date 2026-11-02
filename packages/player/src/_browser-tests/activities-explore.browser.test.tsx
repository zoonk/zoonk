import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectCount } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { getPreviewEntry } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";

function explore(id: string) {
  const entry = getPreviewEntry(id);

  if (!entry) {
    throw new Error(`No preview entry ${id}`);
  }

  renderLessonPlayer({ lesson: buildLesson([entry.screen("explore")]) });
}

describe("activities explored on explanation screens", () => {
  it("number line: shows where the jumps land, with no answer of the learner's to move", async () => {
    explore("activity-numberLine");
    await expect.element(page.getByText("A number line for", { exact: false })).toBeInTheDocument();
    await expectCount(page.getByRole("slider"), 0);
  });

  it("cause-effect chain: names the links as the lesson's, not the learner's", async () => {
    explore("activity-causeEffectChain");
    await expect.element(page.getByRole("list", { name: "How they connect" })).toBeInTheDocument();
    await expectCount(page.getByRole("list", { name: "Your links" }), 0);
  });
});
