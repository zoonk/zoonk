import { type PlayableStepImage } from "@zoonk/core/lesson-player/contract";
import { type VoiceText } from "@zoonk/learn/speech/provider";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { expect } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { type ActivityContent, activityStep } from "./lesson-steps";
import { buildLesson, renderLessonPlayer } from "./render-lesson-player";

/**
 * Helpers for the per-template activity specs (`activities-*.browser.test.tsx`): each one plays a
 * lesson whose single screen is a template's shared valid fixture.
 */

type ActivityTemplate = keyof typeof activityContentFixtures;

/**
 * Plays a one-screen lesson of the template's fixture, or of `content` when given. `voice` stands
 * in for the speech clips endpoint when a test needs to see or change what it answers.
 */
export function openActivity({
  content,
  image,
  template,
  voice,
}: {
  content?: ActivityContent;
  image?: PlayableStepImage;
  template: ActivityTemplate;
  voice?: VoiceText;
}) {
  return renderLessonPlayer({
    lesson: buildLesson([
      activityStep({ content: content ?? activityContentFixtures[template], image }),
    ]),
    ...(voice ? { voice } : {}),
  });
}

/** Plays a lesson of several activity screens, in the order given. */
export function openActivities({ contents }: { contents: ActivityContent[] }) {
  return renderLessonPlayer({
    lesson: buildLesson(contents.map((content) => activityStep({ content }))),
  });
}

/** The field a numeric activity answers in. */
export function valueInput() {
  return page.getByRole("textbox", { name: "What is the value?" });
}

export async function checkActivity() {
  await page.getByRole("button", { exact: true, name: "Check" }).click();
}

export async function expectVerdict(verdict: "Correct!" | "Not quite") {
  await expect
    .element(page.getByRole("region", { name: "Answer feedback" }).getByText(verdict))
    .toBeVisible();
}

/** Presses a key (a Playwright key name such as `ArrowRight`, `Space` or `1`) one or more times. */
export async function press(key: string, times = 1) {
  for (const _ of Array.from({ length: times })) {
    // oxlint-disable-next-line no-await-in-loop -- Each key press lands in turn.
    await userEvent.keyboard(`{${key}}`);
  }
}

/** Moves keyboard focus to an element once it's on screen, as tabbing to it would. */
export async function focusOn(locator: Locator) {
  await expect.element(locator).toBeVisible();
  const element = locator.element();

  if (element instanceof HTMLElement || element instanceof SVGElement) {
    element.focus();
  }
}

/** Presses a key on a slider, once per step the handle moves. */
export async function pressOnSlider(name: string, key: string, times: number) {
  await focusOn(page.getByRole("slider", { name }));
  await press(key, times);
}

/** Drags one element onto another with the mouse, landing at `targetPosition` inside it when given. */
export async function dragOnto(
  from: Locator,
  to: Locator,
  options: { steps?: number; targetPosition?: { x: number; y: number } } = {},
) {
  await expect.element(from).toBeVisible();
  await userEvent.dragAndDrop(from, to, { steps: 8, ...options });
}

/** Presses the mouse on an element's center and moves it by the given offset before letting go. */
export async function dragBy(from: Locator, offset: { x: number; y: number }) {
  await expect.element(from).toBeVisible();
  const box = from.element().getBoundingClientRect();
  const body = document.body.getBoundingClientRect();

  await userEvent.dragAndDrop(from, page.elementLocator(document.body), {
    steps: 6,
    targetPosition: {
      x: box.left + box.width / 2 + offset.x - body.left,
      y: box.top + box.height / 2 + offset.y - body.top,
    },
  });
}

/** How many elements a locator matches, once it settles on `count`. */
export async function expectCount(locator: Locator, count: number) {
  await expect.poll(() => locator.elements()).toHaveLength(count);
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * A drawn picture for a screen, portrait like the pictures lessons draw, inline so the tests don't
 * depend on an image host: the same `img` semantics without network errors or 404 fallbacks.
 */
export function inlineImage({ alt }: { alt: string }): PlayableStepImage {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" viewBox="0 0 1024 1280">',
    '<rect width="1024" height="1280" fill="#f4f4f5" />',
    '<text x="512" y="640" fill="#111827" font-family="Arial, sans-serif" font-size="36" text-anchor="middle">',
    escapeSvgText(alt),
    "</text>",
    "</svg>",
  ].join("");

  return {
    alt,
    height: 1280,
    id: crypto.randomUUID(),
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: 1024,
  };
}
