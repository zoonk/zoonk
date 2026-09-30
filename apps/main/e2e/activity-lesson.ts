import { randomUUID } from "node:crypto";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { type Page, expect } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * Helpers for the per-template activity specs (`lesson-activities*.test.ts`): each one plays a
 * lesson whose single screen is a template's shared valid fixture, in Focus and in Fun.
 */

type ActivityTemplate = keyof typeof activityContentFixtures;

/** Any activity step content; tests that vary a fixture pass plain objects built from it. */
type ActivityContent = { [field: string]: unknown; template: string };

/**
 * A lesson with one activity screen, from the template's fixture unless `content` replaces it,
 * with its drawn picture when `mediaAssetId` is given.
 */
async function createActivityLesson({
  content,
  mediaAssetId,
}: {
  content: ActivityContent;
  mediaAssetId?: string;
}) {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    title: `E2E ${content.template} ${randomUUID()}`,
  });

  await libraryStepFixture({
    content,
    kind: "activity",
    lessonId: lesson.id,
    mediaAssetId,
    position: 0,
  });

  return lesson;
}

/** Opens the lesson in the requested mode; guests keep the mode in a cookie. */
export async function openActivity(
  page: Page,
  {
    content,
    mediaAssetId,
    mode,
    template,
  }: { content?: ActivityContent; mediaAssetId?: string; mode: Mode; template: ActivityTemplate },
) {
  const lesson = await createActivityLesson({
    content: content ?? activityContentFixtures[template],
    mediaAssetId,
  });

  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lesson.id}`);
}

/** The field a numeric activity answers in. */
export function valueInput(page: Page) {
  return page.getByRole("textbox", { name: "What is the value?" });
}

export async function checkActivity(page: Page) {
  await page.getByRole("button", { exact: true, name: "Check" }).click();
}

export async function expectVerdict(page: Page, verdict: "Correct!" | "Not quite") {
  await expect(
    page.getByRole("region", { name: "Answer feedback" }).getByText(verdict),
  ).toBeVisible();
}

export async function pressOnSlider(page: Page, name: string, key: string, times: number) {
  const slider = page.getByRole("slider", { name });
  await slider.focus();

  for (const _ of Array.from({ length: times })) {
    // oxlint-disable-next-line no-await-in-loop -- Each key press moves the handle one step.
    await slider.press(key);
  }
}
