import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";

/**
 * An activity template an explanation screen shows to explore (a model to move, a process, a map,
 * a program to run) draws under the idea with nothing asked: labelled by the idea's words, and
 * accessible on a phone in light and dark.
 */

const PHONE = { height: 812, width: 375 };

const entries = previewEntries.filter((entry) => entry.states.includes("explore"));

function exploredCanvas(): Element | null {
  return document.querySelector("[data-slot='activity-explore'] figure");
}

describe("activities explored on explanation screens", () => {
  it.each(entries.map((entry) => [entry.id, entry] as const))(
    "draws %s on a phone",
    async (_id, entry) => {
      await atViewport(PHONE, async () => {
        renderLessonPlayer({ lesson: buildLesson([entry.screen("explore")]) });

        await expect.poll(exploredCanvas).not.toBeNull();
        await expect.element(page.getByRole("button", { name: /^Check/u })).not.toBeInTheDocument();

        const labelledBy = exploredCanvas()?.getAttribute("aria-labelledby") ?? "";
        const label = document.querySelector(`#${CSS.escape(labelledBy)}`);
        expect(label?.textContent).toContain(entry.label);
        await expectAccessibleScreen(`${entry.id} explored`);
      });
    },
  );
});
