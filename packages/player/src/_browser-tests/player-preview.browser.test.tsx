import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";
import { PlayerPreview } from "../preview/player-preview";
import {
  type PreviewEntry,
  type PreviewState,
  previewEntries,
  previewLesson,
} from "../preview/preview-catalog";

function verdictOf(kind: string) {
  return kind === "hook" ? "Good guess!" : "Correct!";
}

function casesIn(states: readonly PreviewState[]) {
  return previewEntries.flatMap((entry) =>
    entry.states
      .filter((option) => states.includes(option))
      .map((option) => [`${entry.id} (${option})`, entry, option] as const),
  );
}

function play(entry: PreviewEntry, state: PreviewState) {
  render(<PlayerPreview lesson={previewLesson(entry, state)} state={state} />);
}

describe("player preview", () => {
  it.each(casesIn(["answering", "reading"]))("opens %s", async (_name, entry, state) => {
    play(entry, state);
    await expect.element(page.getByText(entry.label).first()).toBeVisible();
  });

  it.each(casesIn(["checked"]))("shows %s as right", async (_name, entry, state) => {
    play(entry, state);
    await expect.element(page.getByRole("button", { name: /^Continue/u })).toBeVisible();
    await expect.element(page.getByText(verdictOf(entry.screen(state).kind)).first()).toBeVisible();
  });
});
