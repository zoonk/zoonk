import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

const STORY_METRICS = [{ label: "Production" }, { label: "Morale" }];
const STORY_CONTEXT_METRICS = [...STORY_METRICS, { label: "Safety" }];

const STORY_SCROLL_METRICS = [
  { label: "Production" },
  { label: "Morale" },
  { label: "Safety" },
  { label: "Inventory" },
  { label: "Quality" },
  { label: "Training" },
  { label: "Maintenance" },
  { label: "Delivery" },
  { label: "Focus" },
  { label: "Trust" },
];

const STORY_OUTCOMES = {
  bad: {
    narrative: "The factory barely holds together",
    title: "Hard Lesson",
  },
  good: {
    narrative: "The factory stabilizes",
    title: "Solid Manager",
  },
  ok: {
    narrative: "The factory recovers unevenly",
    title: "Mixed Shift",
  },
  perfect: {
    image: {
      prompt: "Recovered factory floor with a confident team and stable output",
      url: buildInlineImageUrl({ label: "Story outcome" }),
    },
    narrative: "Excellent leadership",
    title: "Great Manager",
  },
  terrible: {
    narrative: "The factory falls apart",
    title: "Learning Moment",
  },
};
const STORY_CONTEXT_OUTCOMES = {
  ...STORY_OUTCOMES,
  perfect: {
    ...STORY_OUTCOMES.perfect,
    image: {
      prompt: "Recovered factory floor with a confident team and stable output",
      url: buildInlineImageUrl({ label: "Story outcome context" }),
    },
  },
};

/**
 * Verifies the currently visible step image has the standard full-image escape
 * hatch. Story steps render images in several layouts, so this keeps the
 * behavior assertion identical while each screen keeps its own composition.
 */
async function expectCurrentStepImageExpands(imageAlt: string) {
  await page.getByRole("button", { name: /open full image/i }).click();
  const dialog = page.getByRole("dialog", { name: /full image/i });

  await expect.element(dialog.getByAltText(imageAlt)).toBeInTheDocument();

  await page.getByRole("button", { name: /close full image/i }).click();
  await expect.element(dialog).not.toBeInTheDocument();
}

/**
 * Returns the shared player scroll container through its accessible region.
 * The feedback scroll regression lives on this shell, not inside a specific
 * story child component, so the test needs to inspect the real stage element.
 */
function getPlayerScreenElement() {
  return page.getByRole("region", { name: /player screen/i }).element() as HTMLElement;
}

/**
 * Recreates the user path where a learner scrolls down before choosing an
 * answer. The assertion proves the test is exercising an actual scrollable
 * screen instead of setting scrollTop on a short page.
 */
function scrollPlayerScreenToBottom() {
  const playerScreen = getPlayerScreenElement();

  expect(playerScreen.scrollHeight).toBeGreaterThan(playerScreen.clientHeight);

  playerScreen.scrollTop = playerScreen.scrollHeight;
  fireEvent.scroll(playerScreen);

  expect(playerScreen.scrollTop).toBeGreaterThan(0);
}

/**
 * Checks the active player screen after a scene transition. Feedback should
 * always start at the top so the image and first consequence are visible.
 */
function expectPlayerScreenAtTop() {
  expect(getPlayerScreenElement().scrollTop).toBe(0);
}

describe("player browser integration: story", () => {
  test("runs the shared story flow from intro to completion", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "Factory floor at sunrise with anxious workers waiting for instructions",
                url: buildInlineImageUrl({ label: "Story intro" }),
              },
              text: "You are leading the factory team.",
              title: "Factory trouble",
              variant: "intro" as const,
            },
            id: "story-intro",
            kind: "static",
          }),
          buildSerializedStep({
            content: {
              choices: [
                {
                  alignment: "strong" as const,
                  consequence: "Production surges",
                  id: "story-choice-1",
                  metricEffects: [
                    { effect: "positive" as const, metric: "Production" },
                    { effect: "positive" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt: "Factory floor after training begins and the team regains confidence",
                    url: buildInlineImageUrl({ label: "Story state train" }),
                  },
                  text: "Invest in training",
                },
                {
                  alignment: "weak" as const,
                  consequence: "Morale drops",
                  id: "story-choice-2",
                  metricEffects: [
                    { effect: "negative" as const, metric: "Production" },
                    { effect: "negative" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt:
                      "Factory floor after cuts with workers frustrated and stations falling behind",
                    url: buildInlineImageUrl({ label: "Story state cut" }),
                  },
                  text: "Cut costs",
                },
              ],
              image: {
                prompt: "Factory floor in crisis with stalled stations and workers waiting",
                url: buildInlineImageUrl({ label: "Story step" }),
              },
              problem: "A crisis hits the factory floor",
            },
            id: "story-decision",
            kind: "story",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              metrics: STORY_METRICS,
              outcomes: STORY_OUTCOMES,
              variant: "storyOutcome" as const,
            },
            id: "story-outcome",
            kind: "static",
            position: 2,
          }),
          buildSerializedStep({
            content: {
              text: "Training investment builds capacity",
              title: "Resource Allocation",
              variant: "text" as const,
            },
            id: "story-debrief",
            kind: "static",
            position: 3,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(
        page.getByAltText("Factory floor at sunrise with anxious workers waiting for instructions"),
      )
      .toBeInTheDocument();

    await expectCurrentStepImageExpands(
      "Factory floor at sunrise with anxious workers waiting for instructions",
    );

    await page.getByRole("button", { name: /begin/i }).click();
    await page.getByRole("radio", { name: /invest in training/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect
      .element(
        page.getByAltText("Factory floor after training begins and the team regains confidence"),
      )
      .toBeInTheDocument();

    await expectCurrentStepImageExpands(
      "Factory floor after training begins and the team regains confidence",
    );

    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByRole("heading", { name: "Great Manager" })).toBeInTheDocument();
    await expect
      .element(page.getByAltText("Recovered factory floor with a confident team and stable output"))
      .toBeInTheDocument();

    await expectCurrentStepImageExpands(
      "Recovered factory floor with a confident team and stable output",
    );

    await page.getByRole("button", { name: /continue/i }).click();
    await expect
      .element(page.getByRole("heading", { name: "Resource Allocation" }))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();
  });

  test("shows story context in lesson info and metric impact on feedback", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "Factory floor at sunrise with anxious workers waiting for instructions",
                url: buildInlineImageUrl({ label: "Story intro context" }),
              },
              text: "You are leading the factory team.",
              title: "Factory trouble",
              variant: "intro" as const,
            },
            id: "story-intro-context",
            kind: "static",
          }),
          buildSerializedStep({
            content: {
              choices: [
                {
                  alignment: "strong" as const,
                  consequence: "Production surges",
                  id: "story-choice-1",
                  metricEffects: [
                    { effect: "positive" as const, metric: "Production" },
                    { effect: "positive" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt: "Factory floor after training begins and the team regains confidence",
                    url: buildInlineImageUrl({ label: "Story state train context" }),
                  },
                  text: "Invest in training",
                },
                {
                  alignment: "weak" as const,
                  consequence: "Morale drops",
                  id: "story-choice-2",
                  metricEffects: [
                    { effect: "negative" as const, metric: "Production" },
                    { effect: "negative" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt:
                      "Factory floor after cuts with workers frustrated and stations falling behind",
                    url: buildInlineImageUrl({ label: "Story state cut context" }),
                  },
                  text: "Cut costs",
                },
              ],
              image: {
                prompt: "Factory floor in crisis with stalled stations and workers waiting",
                url: buildInlineImageUrl({ label: "Story step context" }),
              },
              problem: "A crisis hits the factory floor",
            },
            id: "story-decision-context",
            kind: "story",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              metrics: STORY_CONTEXT_METRICS,
              outcomes: STORY_CONTEXT_OUTCOMES,
              variant: "storyOutcome" as const,
            },
            id: "story-outcome-context",
            kind: "static",
            position: 2,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /begin/i }).click();

    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /context/i })).not.toBeInTheDocument();
    await page.getByRole("button", { name: /lesson info/i }).click();

    const lessonInfoDialog = page.getByRole("dialog", { name: "Test Lesson" });

    await expect
      .element(lessonInfoDialog)
      .toHaveAccessibleDescription("You are leading the factory team.");

    await expect
      .element(lessonInfoDialog)
      .not.toHaveAccessibleDescription("Test lesson description");

    await page.getByRole("button", { name: /lesson info/i }).click();
    await expect.element(lessonInfoDialog).not.toBeInTheDocument();

    await page.getByRole("radio", { name: /invest in training/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText("Production surges")).toBeInTheDocument();
    await expect.element(page.getByText(/your answer:/i)).not.toBeInTheDocument();
    const metricChanges = page.getByRole("list", { name: /metric changes/i });

    await expect.element(metricChanges).toBeInTheDocument();
    await expect.element(metricChanges).toHaveTextContent(/Production.*Morale.*Safety/s);

    await expect
      .element(page.getByRole("listitem", { name: /production \+15 65/i }))
      .toBeInTheDocument();

    await expect
      .element(page.getByRole("listitem", { name: /morale \+15 65/i }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("listitem", { name: /safety 0 50/i })).toBeInTheDocument();

    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();
  });

  test("shows story feedback from the top after selecting from a scrolled decision", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              choices: [
                {
                  alignment: "weak" as const,
                  consequence: "The repair backlog grows.",
                  id: "story-choice-1",
                  metricEffects: [{ effect: "negative" as const, metric: "Production" }],
                  stateImage: {
                    prompt: "Factory floor with stalled repairs and anxious workers",
                    url: buildInlineImageUrl({ label: "Story scroll feedback stalled" }),
                  },
                  text: "Keep the current shift running and hope the broken conveyor holds.",
                },
                {
                  alignment: "partial" as const,
                  consequence: "The team understands the risk but output still slips.",
                  id: "story-choice-2",
                  metricEffects: [{ effect: "neutral" as const, metric: "Production" }],
                  stateImage: {
                    prompt: "Factory floor with a short repair briefing beside the conveyor",
                    url: buildInlineImageUrl({ label: "Story scroll feedback briefing" }),
                  },
                  text: "Hold a short briefing, then ask each station to report problems later.",
                },
                {
                  alignment: "strong" as const,
                  consequence:
                    "Repairs restart safely and the team sees the plan. The maintenance lead checks every station, the floor manager explains the pause, and the next batch moves only after the checklist is visible to everyone.",
                  id: "story-choice-3",
                  metricEffects: STORY_SCROLL_METRICS.map((metric) => ({
                    effect: "positive" as const,
                    metric: metric.label,
                  })),
                  stateImage: {
                    prompt: "Factory floor after repairs restart safely with a clear team plan",
                    url: buildInlineImageUrl({ label: "Story scroll feedback repair" }),
                  },
                  text: "Pause the line, assign repair owners, and reopen only after the checklist passes.",
                },
              ],
              image: {
                prompt: "Factory floor with a broken conveyor and a long repair queue",
                url: buildInlineImageUrl({ label: "Story scroll decision" }),
              },
              problem:
                "A conveyor breaks during the busiest hour. Workers are waiting for direction, inventory is piling up, and the fastest option is buried below the first visible choices.",
            },
            id: "story-scroll-decision",
            kind: "story",
          }),
          buildSerializedStep({
            content: {
              metrics: STORY_SCROLL_METRICS,
              outcomes: STORY_OUTCOMES,
              variant: "storyOutcome" as const,
            },
            id: "story-scroll-outcome",
            kind: "static",
            position: 1,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    scrollPlayerScreenToBottom();

    await page
      .getByRole("radio", {
        name: /pause the line, assign repair owners/i,
      })
      .click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect
      .element(
        page.getByAltText("Factory floor after repairs restart safely with a clear team plan"),
      )
      .toBeInTheDocument();

    expectPlayerScreenAtTop();
  });
});
