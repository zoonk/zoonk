import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: investigation", () => {
  test("runs the shared investigation loop through call resolution", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "investigation",
        steps: [
          buildSerializedStep({
            content: {
              scenario: "The API has been throwing intermittent 500 errors.",
              variant: "problem" as const,
            },
            id: "investigation-problem",
            kind: "investigation",
          }),
          buildSerializedStep({
            content: {
              options: [
                {
                  feedback: "Logs point to a memory leak.",
                  id: "action-1",
                  quality: "critical" as const,
                  text: "Check server logs",
                },
                {
                  feedback: "The latest deploy introduced a regression.",
                  id: "action-2",
                  quality: "critical" as const,
                  text: "Check deploy history",
                },
              ],
              variant: "action" as const,
            },
            id: "investigation-action",
            kind: "investigation",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              options: [
                {
                  accuracy: "best" as const,
                  feedback: "Correct. The memory leak caused the failures.",
                  id: "call-1",
                  text: "Memory leak in the API service",
                },
                {
                  accuracy: "wrong" as const,
                  feedback: "No. The network was healthy.",
                  id: "call-2",
                  text: "Network switch failure",
                },
              ],
              variant: "call" as const,
            },
            id: "investigation-call",
            kind: "investigation",
            position: 2,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: /start investigation/i }).click();
    await expect.element(page.getByRole("button", { name: /context/i })).not.toBeInTheDocument();
    await page.getByRole("button", { name: /lesson info/i }).click();

    const lessonInfoDialog = page.getByRole("dialog", { name: "Test Lesson" });

    await expect
      .element(lessonInfoDialog)
      .toHaveAccessibleDescription("The API has been throwing intermittent 500 errors.");

    await expect
      .element(lessonInfoDialog)
      .not.toHaveAccessibleDescription("Test lesson description");
    await page.getByRole("button", { name: /lesson info/i }).click();

    await page.getByRole("radio", { name: "Check server logs" }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: "Check deploy history" }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: /memory leak in the api service/i }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByText("3/3")).toBeInTheDocument();
  });

  test("filters used investigation actions and lets learners review gathered evidence", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "investigation",
        steps: [
          buildSerializedStep({
            content: {
              scenario: "The API has been throwing intermittent 500 errors.",
              variant: "problem" as const,
            },
            id: "investigation-problem-review",
            kind: "investigation",
          }),
          buildSerializedStep({
            content: {
              options: [
                {
                  feedback: "Logs point to a memory leak.",
                  id: "action-1",
                  quality: "critical" as const,
                  text: "Check server logs",
                },
                {
                  feedback: "The latest deploy introduced a regression.",
                  id: "action-2",
                  quality: "useful" as const,
                  text: "Check deploy history",
                },
                {
                  feedback: "A cache node restarted once.",
                  id: "action-3",
                  quality: "weak" as const,
                  text: "Inspect the cache",
                },
              ],
              variant: "action" as const,
            },
            id: "investigation-action-review",
            kind: "investigation",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              options: [
                {
                  accuracy: "best" as const,
                  feedback: "Correct. The memory leak caused the failures.",
                  id: "call-1",
                  text: "Memory leak in the API service",
                },
                {
                  accuracy: "wrong" as const,
                  feedback: "No. The network was healthy.",
                  id: "call-2",
                  text: "Network switch failure",
                },
              ],
              variant: "call" as const,
            },
            id: "investigation-call-review",
            kind: "investigation",
            position: 2,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { name: /start investigation/i }).click();

    await page.getByRole("radio", { name: "Check server logs" }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect
      .element(page.getByRole("radio", { name: "Check server logs" }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText(/1 \/ 2/i)).toBeInTheDocument();

    await page.getByRole("radio", { name: "Check deploy history" }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("button", { name: /review evidence/i }).click();
    await expect.element(page.getByText("Logs point to a memory leak.")).toBeInTheDocument();
    await expect
      .element(page.getByText("The latest deploy introduced a regression."))
      .toBeInTheDocument();
  });
});
