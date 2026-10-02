import { LessonBuddyCompanion } from "@zoonk/learn/buddy-companion";
import { type ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { teachingStep } from "../_test-utils/lesson-steps";
import { buildLesson, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerSlots } from "../lesson/lesson-player-context";

const SIZES = {
  desktop: { height: 800, width: 1280 },
  phone: { height: 812, width: 375 },
} as const;

/** Each line is a new element, so the line is always read fresh from the page. */
const LINE = '[aria-live="polite"] [data-slot="buddy-speech"]';

type Box = { height: number; width: number; x: number; y: number };

/**
 * A new Fun learner's buddy as the app draws it (`getLearnerBuddy`): Zu with round glasses from
 * the profile, a white belt and no Energy, since there's no progress yet.
 */
const BUDDY: ComponentProps<typeof LessonBuddyCompanion>["buddy"] = {
  beltColor: "white",
  energy: 0,
  glasses: "round",
  kind: "zu",
  name: null,
  studiedToday: false,
};

/** The app's companion slot for a learner with a buddy: the buddy beside the paper. */
const SLOTS: LessonPlayerSlots = {
  companion: (moment) => <LessonBuddyCompanion {...moment} buddy={BUDDY} />,
};

function queryAll(selector: string) {
  return [...document.querySelectorAll<HTMLElement | SVGElement>(selector)];
}

/** The one element at a CSS selector, once it's on the page. */
async function locate(selector: string) {
  await expect.poll(() => queryAll(selector)).toHaveLength(1);
  const [element] = queryAll(selector);

  if (!element) {
    throw new Error(`Nothing matches ${selector}`);
  }

  return element;
}

async function boxOf(selector: string): Promise<Box> {
  const element = await locate(selector);
  await expect.element(element).toBeVisible();
  const { height, width, x, y } = element.getBoundingClientRect();

  return { height, width, x, y };
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

/** Where the buddy and the paper sit on the screen. */
async function companionLayout() {
  const [paper, buddy] = await Promise.all([
    boxOf('[data-slot="fun-paper"]'),
    boxOf('[data-slot="fun-companion"] [data-slot="buddy"]'),
  ]);

  return { buddy, paper };
}

async function expectLine(text: string) {
  await expect.poll(() => queryAll(LINE).map((element) => element.textContent)).toEqual([text]);
}

describe("lesson buddy", () => {
  it.each(Object.entries(SIZES))(
    "Fun on a %s: the buddy and its line have their own space, off the paper",
    async (size, viewport) => {
      await atViewport(viewport, async () => {
        renderLessonPlayer({
          lesson: buildLesson([teachingStep("hook"), teachingStep("explanation")]),
          mode: "fun",
          slots: SLOTS,
        });

        // Each line is announced politely, from a region that stays on the page between lines.
        await expect.element(await locate(LINE)).toBeVisible();
        await expectLine("Ready when you are.");

        const speaking = await companionLayout();
        const lineBox = await boxOf(LINE);

        expect(overlaps(lineBox, speaking.paper)).toBe(false);
        expect(overlaps(speaking.buddy, speaking.paper)).toBe(false);

        // Above the paper on phones; beside it on desktop, where the paper keeps the center column.
        const lineEnd = size === "phone" ? lineBox.y + lineBox.height : lineBox.x + lineBox.width;
        const paperStart = size === "phone" ? speaking.paper.y : speaking.paper.x;
        expect(lineEnd).toBeLessThanOrEqual(paperStart);

        await page.getByRole("radio", { name: "No" }).click();
        await page.getByRole("button", { name: /^See the answer/u }).click();
        await expectLine("Nice one!");
        await page.getByRole("button", { name: /^Continue/u }).click();

        // While the learner reads, the buddy is quiet in the same spot: its lines never move the paper.
        await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
        await expect.poll(() => queryAll(LINE)).toHaveLength(0);

        const quiet = await companionLayout();

        expect(quiet.paper.x - quiet.buddy.x).toBe(speaking.paper.x - speaking.buddy.x);
        expect(quiet.paper.y - quiet.buddy.y).toBe(speaking.paper.y - speaking.buddy.y);
      });
    },
  );
});
