import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { PlayerPreview } from "../preview/player-preview";
import {
  type PreviewEntry,
  type PreviewState,
  previewEntries,
  previewLesson,
} from "../preview/preview-catalog";

/**
 * The playground plays every screen of the catalog in the real player: each opens, an explored
 * template draws its canvas on the explanation screen, and each question opened checked shows its
 * result as right, so the gallery never shows a broken screen.
 */

/** A guess shows its answer, not a verdict. */
function verdictOf(kind: string) {
  return kind === "hook" ? "Good guess!" : "Correct!";
}

function casesIn(state?: PreviewState) {
  return previewEntries.flatMap((entry) =>
    entry.states
      .filter((option) => state === undefined || option === state)
      .map((option) => [`${entry.id} (${option})`, entry, option] as const),
  );
}

function play(entry: PreviewEntry, state: PreviewState) {
  render(<PlayerPreview lesson={previewLesson(entry, state)} state={state} />);
}

describe("player preview", () => {
  it.each(casesIn())("opens %s", async (_name, entry, state) => {
    play(entry, state);
    await expect.element(page.getByText(entry.label).first()).toBeVisible();
  });

  it.each(casesIn("explore"))("draws %s on an explanation screen", async (_name, entry, state) => {
    play(entry, state);

    await expect
      .poll(() => document.querySelector("[data-slot='activity-explore'] figure"))
      .not.toBeNull();
  });

  it.each(casesIn("checked"))("shows %s as right", async (_name, entry, state) => {
    play(entry, state);
    await expect.element(page.getByRole("button", { name: /^Continue/u })).toBeVisible();
    await expect.element(page.getByText(verdictOf(entry.screen(state).kind)).first()).toBeVisible();
  });
});
