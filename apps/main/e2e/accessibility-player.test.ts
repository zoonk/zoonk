import { prisma } from "@zoonk/db";
import { type AccessibilityRoute, expectAccessibleRoutes } from "@zoonk/e2e/fixtures/accessibility";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  languageLessonFixture,
  playableStepContent,
} from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { MODES, showInMode } from "./learn-personas";

/**
 * Accessibility of the lesson player: every screen kind and all 43 activity templates open as the
 * first screen of a lesson, in Focus and in Fun, at phone and desktop widths, light and dark (Fun
 * is dark only, so it's scanned on a light device and checked to stay dark).
 */

const SCAN_TIMEOUT_MS = 600_000;

/** Screen kinds whose content the shared playable fixtures don't hold. */
const EXTRA_STEP_CONTENT = {
  alphabet: {
    audioText: "あ",
    audioUrl: null,
    forms: [{ label: "Katakana", symbol: "ア" }],
    pronunciation: "a",
    readingAid: "Like the a in father",
    symbol: "あ",
  },
  matchColumns: {
    pairs: [
      { left: "Electron", right: "Negative charge" },
      { left: "Proton", right: "Positive charge" },
      { left: "Neutron", right: "No charge" },
    ],
    question: "Match each particle to its charge",
  },
};

const STEP_CONTENT = { ...playableStepContent, ...EXTRA_STEP_CONTENT };

type StepKind = keyof typeof STEP_CONTENT;

const LANGUAGE_STEP_KINDS = ["vocabulary", "translation", "reading", "listening"] as const;

/** The lesson player's content, so an error page is never scanned in its place. */
async function waitForScreen(page: Page) {
  await expect(page.getByRole("main", { name: "Lesson content" })).toBeVisible();
}

function lessonRoute(label: string, lessonId: string): AccessibilityRoute {
  return { label, path: `/learn/${lessonId}`, ready: waitForScreen };
}

/** A written lesson whose only screen is the given one. */
async function createOneScreenLesson({ content, kind }: { content: object; kind: StepKind }) {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    specStatus: "completed",
  });

  await libraryStepFixture({ content, kind, lessonId: lesson.id, position: 0 });
  return lesson;
}

/** A lesson per screen kind, each opening on that screen. */
async function createScreenLessons() {
  const kinds = Object.keys(STEP_CONTENT) as StepKind[];

  return Promise.all(
    kinds.map(async (kind) => {
      const lesson = await createOneScreenLesson({ content: STEP_CONTENT[kind], kind });
      return lessonRoute(kind, lesson.id);
    }),
  );
}

/** A language lesson per language screen: the shared lesson keeps only that screen. */
async function createLanguageLessons() {
  return Promise.all(
    LANGUAGE_STEP_KINDS.map(async (kind, position) => {
      const { lesson } = await languageLessonFixture();
      await prisma.step.deleteMany({ where: { lessonId: lesson.id, position: { not: position } } });

      return lessonRoute(kind, lesson.id);
    }),
  );
}

type ActivityTemplate = keyof typeof activityContentFixtures;

/** Templates scanned per test, so the 43 of them run in parallel batches. */
const TEMPLATES_PER_TEST = 8;

const ACTIVITY_TEMPLATES = Object.keys(activityContentFixtures) as ActivityTemplate[];

const ACTIVITY_BATCHES = Array.from(
  { length: Math.ceil(ACTIVITY_TEMPLATES.length / TEMPLATES_PER_TEST) },
  (_, index) =>
    ACTIVITY_TEMPLATES.slice(index * TEMPLATES_PER_TEST, (index + 1) * TEMPLATES_PER_TEST),
);

async function createActivityLessons(templates: ActivityTemplate[]) {
  return Promise.all(
    templates.map(async (template) => {
      const lesson = await createOneScreenLesson({
        content: activityContentFixtures[template],
        kind: "activity",
      });

      return lessonRoute(template, lesson.id);
    }),
  );
}

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

for (const mode of MODES) {
  test.describe(`Lesson player is accessible in ${mode}`, () => {
    test("every screen kind", async ({ noProgressUser, userWithoutProgress: page }) => {
      const [screens, language] = await Promise.all([
        createScreenLessons(),
        createLanguageLessons(),
        showInMode(page.context(), { mode, userId: noProgressUser.id }),
      ]);

      await expectAccessibleRoutes(page, [...screens, ...language]);
    });

    for (const templates of ACTIVITY_BATCHES) {
      test(`activities ${templates.join(", ")}`, async ({
        noProgressUser,
        userWithoutProgress: page,
      }) => {
        const [activities] = await Promise.all([
          createActivityLessons(templates),
          showInMode(page.context(), { mode, userId: noProgressUser.id }),
        ]);

        await expectAccessibleRoutes(page, activities);
      });
    }
  });
}
