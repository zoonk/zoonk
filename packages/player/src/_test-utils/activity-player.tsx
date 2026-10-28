import { type PlayableStepImage } from "@zoonk/core/lesson-player/contract";
import { type VoiceText } from "@zoonk/learn/speech/provider";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { expect } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { buildLesson } from "../preview/preview-lesson";
import { type ActivityContent, activityStep } from "../preview/preview-steps";
import { renderLessonPlayer } from "./render-lesson-player";

type ActivityTemplate = keyof typeof activityContentFixtures;

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

export function openActivities({ contents }: { contents: ActivityContent[] }) {
  return renderLessonPlayer({
    lesson: buildLesson(contents.map((content) => activityStep({ content }))),
  });
}

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

export async function press(key: string, times = 1) {
  for (const _ of Array.from({ length: times })) {
    // oxlint-disable-next-line no-await-in-loop -- Each key press lands in turn.
    await userEvent.keyboard(`{${key}}`);
  }
}

export function pressOnPage(key: string) {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  return press(key);
}

export async function focusOn(locator: Locator) {
  await expect.element(locator).toBeVisible();
  const element = locator.element();

  if (element instanceof HTMLElement || element instanceof SVGElement) {
    element.focus();
  }
}

export async function pressOnSlider(name: string, key: string, times: number) {
  await focusOn(page.getByRole("slider", { name }));
  await press(key, times);
}

export async function dragOnto(
  from: Locator,
  to: Locator,
  options: { steps?: number; targetPosition?: { x: number; y: number } } = {},
) {
  await expect.element(from).toBeVisible();
  await userEvent.dragAndDrop(from, to, { steps: 8, ...options });
}

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

export async function expectCount(locator: Locator, count: number) {
  await expect.poll(() => locator.elements()).toHaveLength(count);
}
