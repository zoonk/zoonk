import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";

/**
 * An activity template an explanation screen shows to explore (a model to move, a process, a map,
 * a program to run) draws under the idea with nothing asked: labelled by the idea's words, inside
 * the screen's width on a phone and a desktop, and accessible in light and dark.
 */

const VIEWPORTS = [
  ["phone", { height: 812, width: 375 }],
  ["desktop", { height: 720, width: 1280 }],
] as const;

const cases = previewEntries.flatMap((entry) =>
  entry.states.includes("explore")
    ? VIEWPORTS.map(([device, size]) => [`${entry.id} on a ${device}`, entry, size] as const)
    : [],
);

function exploredCanvas(): Element | null {
  return document.querySelector("[data-slot='activity-explore'] figure");
}

describe("activities explored on explanation screens", () => {
  it.each(cases)("draws %s", async (_name, entry, size) => {
    await atViewport(size, async () => {
      renderLessonPlayer({ lesson: buildLesson([entry.screen("explore")]) });

      await expect.poll(exploredCanvas).not.toBeNull();
      await expect.element(page.getByRole("button", { name: /^Check/u })).not.toBeInTheDocument();

      const labelledBy = exploredCanvas()?.getAttribute("aria-labelledby") ?? "";
      const label = document.querySelector(`#${CSS.escape(labelledBy)}`);
      expect(label?.textContent).toContain(entry.label);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(size.width);

      await expectAccessibleScreen(`${entry.id} explored`);
    });
  });
});
