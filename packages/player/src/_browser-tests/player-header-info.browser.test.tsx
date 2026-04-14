import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player header: activity title and lesson info", () => {
  test("shows the activity title in the header", async () => {
    renderPlayer({
      activity: buildSerializedActivity({ title: "Basic Greetings" }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Basic Greetings")).toBeInTheDocument();
  });

  test("shows the activity kind label when title is null", async () => {
    renderPlayer({
      activity: buildSerializedActivity({ kind: "vocabulary", title: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Vocabulary")).toBeInTheDocument();
  });

  test("lesson info popover shows lesson and chapter details", async () => {
    renderPlayer({
      activity: buildSerializedActivity(),
      chapterTitle: "Verb Fundamentals",
      lessonDescription: "Learn present tense conjugation patterns.",
      lessonTitle: "Present Tense",
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: /lesson info/i }).click();

    await expect.element(page.getByRole("heading", { name: "Present Tense" })).toBeInTheDocument();
    await expect
      .element(page.getByText("Learn present tense conjugation patterns."))
      .toBeInTheDocument();
    await expect.element(page.getByText("Verb Fundamentals")).toBeInTheDocument();
  });
});
