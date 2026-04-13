import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: arrangement steps", () => {
  test("matches pairs and auto-advances to the next step after checking", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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
    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByRole("heading", { name: "Next step" })).toBeInTheDocument();
  });

  test("checks a preordered sort step without requiring app-specific routing", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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

    await expect.element(page.getByRole("button", { name: /check/i })).toBeEnabled();
    await page.getByRole("button", { name: /check/i }).click();
    await expect
      .element(page.getByRole("region", { name: /answer feedback/i }))
      .toBeInTheDocument();
  });

  test("keeps match-columns mistakes in the completion result even after correction", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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
    await expect.element(page.getByRole("button", { name: /check/i })).toBeEnabled();

    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByRole("status")).toBeInTheDocument();
    await expect.element(page.getByText("0/1")).toBeInTheDocument();
  });

  test("shows the correct order when the shared sort-order answer is wrong", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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

    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText(/correct order:/i)).toBeInTheDocument();
    await expect.element(page.getByText("Try again")).toBeInTheDocument();
  });
});
