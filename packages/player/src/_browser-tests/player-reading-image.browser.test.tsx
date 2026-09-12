import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { runInMobilePlayerViewport } from "../_test-utils/browser-viewport";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: reading illustrations", () => {
  it("describes a teaching diagram without reading its generation instructions", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                alt: "The original photos are on one drive and their backup is on another.",
                prompt: "Render two drives. Use readable labels and exclude decoration.",
                url: buildInlineImageUrl({ label: "Separate copies" }),
              },
              text: "Separate drives protect both copies from a single drive failure.",
              title: "Separate copies",
              variant: "text",
            },
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(
        page.getByRole("img", {
          name: "The original photos are on one drive and their backup is on another.",
        }),
      )
      .toBeVisible();

    await expect.element(page.getByAltText(/Render two drives/u)).not.toBeInTheDocument();
  });

  it("keeps teaching readable when artwork is missing or fails and recovers for the next image", async () => {
    await runInMobilePlayerViewport(async () => {
      renderPlayer({
        lesson: buildSerializedLesson({
          kind: "explanation",
          steps: [
            buildSerializedStep({
              content: {
                image: { prompt: "Draw a diagram. Do not add decorative objects." },
                text: "A backup is another copy you can recover if the original is lost.",
                title: "A second copy",
                variant: "text",
              },
            }),
            buildSerializedStep({
              content: {
                image: {
                  prompt: "Render a drive. Use small labels and a flat background.",
                  // A malformed data image exercises the browser's actual load failure without a network dependency.
                  url: "data:image/png;base64,aW52YWxpZA==",
                },
                text: "Keep your backup on another drive so a broken drive cannot take both copies.",
                title: "Separate the copies",
                variant: "text",
              },
              id: "failed-artwork",
              position: 1,
            }),
            buildSerializedStep({
              content: {
                image: {
                  prompt: "Two separate drives",
                  url: buildInlineImageUrl({ label: "Two separate drives" }),
                },
                text: "The original and its backup are stored separately.",
                title: "Two safe places",
                variant: "text",
              },
              id: "available-artwork",
              position: 2,
            }),
          ],
        }),
        viewer: buildAuthenticatedViewer(),
      });

      await expect.element(page.getByRole("heading", { name: "A second copy" })).toBeVisible();
      await expect.element(page.getByText(/Draw a diagram/u)).not.toBeInTheDocument();
      await page.getByRole("button", { exact: true, name: "Next" }).click();

      await expect
        .element(page.getByRole("heading", { name: "Separate the copies" }))
        .toBeVisible();

      await expect.element(page.getByText(/Keep your backup on another drive/u)).toBeVisible();
      await expect.element(page.getByRole("img")).not.toBeInTheDocument();
      await expect.element(page.getByText(/Render a drive/u)).not.toBeInTheDocument();
      await page.getByRole("button", { exact: true, name: "Next" }).click();

      await expect.element(page.getByRole("heading", { name: "Two safe places" })).toBeVisible();
      await expect.element(page.getByRole("img", { name: "Two safe places" })).toBeVisible();
    });
  });

  it("keeps a practice question answerable when its contextual artwork fails", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "practice",
        steps: [
          buildSerializedStep({
            content: {
              context: "Both copies are stored on the same drive.",
              image: {
                alt: "One drive contains the original and its backup.",
                prompt: "Draw a drive and place two folder symbols inside it.",
                url: "data:image/png;base64,aW52YWxpZA==",
              },
              options: [
                {
                  feedback: "Separate drives protect against one drive failing.",
                  id: "separate",
                  isCorrect: true,
                  text: "Move the backup to another drive",
                },
                {
                  feedback: "Renaming a folder does not protect it from drive failure.",
                  id: "rename",
                  isCorrect: false,
                  text: "Rename the backup folder",
                },
              ],
              question: "How could you protect the backup from a broken drive?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("img")).not.toBeInTheDocument();
    await expect.element(page.getByText(/Draw a drive/u)).not.toBeInTheDocument();
    await page.getByRole("radio", { name: "Move the backup to another drive" }).click();
    await page.getByRole("button", { exact: true, name: "Check" }).click();

    await expect
      .element(page.getByText("Separate drives protect against one drive failing."))
      .toBeVisible();
  });
});
