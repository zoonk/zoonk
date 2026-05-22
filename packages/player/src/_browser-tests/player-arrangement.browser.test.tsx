import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: arrangement steps", () => {
  it("matches pairs and auto-advances to the next step after checking", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              pairs: [
                { left: "Sun", right: "Day" },
                { left: "Moon", right: "Night" },
              ],
              question: "Match each item",
            },
            id: "match-1",
            kind: "matchColumns",
            matchColumnsRightItems: ["Day", "Night"],
          }),
          buildSerializedStep({
            content: { text: "Matched", title: "Next step", variant: "text" as const },
            id: "static-after-match",
            position: 1,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: "Sun" }).click();
    await page.getByRole("button", { name: "Day" }).click();
    await page.getByRole("button", { name: "Moon" }).click();
    await page.getByRole("button", { name: "Night" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByRole("heading", { name: "Next step" })).toBeInTheDocument();
  });

  it("uses a generic match prompt when generated content has no question", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              pairs: [
                { left: "Sun", right: "Day" },
                { left: "Moon", right: "Night" },
              ],
            },
            id: "match-without-question",
            kind: "matchColumns",
            matchColumnsRightItems: ["Day", "Night"],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "Match the pairs." })).toBeVisible();
  });

  it("keeps duplicate match-column labels selectable until each visible item is matched", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              pairs: [
                { left: "Alpha", right: "One" },
                { left: "Alpha", right: "Two" },
                { left: "Beta", right: "One" },
              ],
              question: "Match each item",
            },
            id: "match-duplicates",
            kind: "matchColumns",
            matchColumnsRightItems: ["One", "Two", "One"],
          }),
          buildSerializedStep({
            content: { text: "Matched duplicates", title: "Next step", variant: "text" as const },
            id: "static-after-duplicates",
            position: 1,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: "Alpha" }).nth(0).click();
    await page.getByRole("button", { name: "One" }).nth(0).click();

    await expect.element(page.getByRole("button", { name: "Alpha" }).nth(1)).toBeEnabled();
    await expect.element(page.getByRole("button", { name: "One" }).nth(1)).toBeEnabled();

    await page.getByRole("button", { name: "Alpha" }).nth(1).click();
    await page.getByRole("button", { name: "Two" }).click();
    await page.getByRole("button", { name: "Beta" }).click();
    await page.getByRole("button", { name: "One" }).nth(1).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByRole("heading", { name: "Next step" })).toBeInTheDocument();
  });

  it("checks a preordered sort step without requiring app-specific routing", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              feedback: "Ordered",
              items: ["Alpha", "Beta", "Gamma"],
              question: "Sort alphabetically",
            },
            kind: "sortOrder",
            sortOrderItems: ["Alpha", "Beta", "Gamma"],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect
      .element(page.getByRole("region", { name: /answer feedback/iu }))
      .toBeInTheDocument();
  });

  it("keeps match-columns mistakes in the completion result even after correction", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              pairs: [
                { left: "Sun", right: "Day" },
                { left: "Moon", right: "Night" },
              ],
              question: "Match each item",
            },
            id: "match-mistake",
            kind: "matchColumns",
            matchColumnsRightItems: ["Day", "Night"],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: "Night" }).click();
    await page.getByRole("button", { name: "Sun" }).click();

    await expect.element(page.getByRole("button", { name: "Night" })).toBeEnabled();
    await page.getByRole("button", { name: "Day" }).click();
    await page.getByRole("button", { name: "Sun" }).click();
    await page.getByRole("button", { name: "Moon" }).click();
    await page.getByRole("button", { name: "Night" }).click();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();

    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByRole("status")).toBeInTheDocument();
    await expect.element(page.getByText("0/1")).toBeInTheDocument();
  });

  it("shows the correct order when the shared sort-order answer is wrong", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              feedback: "Try again",
              items: ["Alpha", "Beta", "Gamma"],
              question: "Sort alphabetically",
            },
            kind: "sortOrder",
            sortOrderItems: ["Beta", "Alpha", "Gamma"],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByText(/correct order:/iu)).toBeInTheDocument();
    await expect.element(page.getByText("Try again")).toBeInTheDocument();
  });
});
