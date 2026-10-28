import { type ContentFeedbackAdapters, ContentFeedbackProvider } from "@zoonk/learn/feedback";
import { ReportProblemItem } from "@zoonk/learn/feedback/menu-items";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { tabTo } from "../_test-utils/keyboard";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { type LessonPlayerSlots } from "../lesson/lesson-player-context";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import {
  activityStep,
  languageStep,
  spokenAnswerStep,
  teachingStep,
} from "../preview/preview-steps";

const TABLET_PORTRAIT = { height: 1180, width: 820 };

type ActivityTemplate = keyof typeof activityContentFixtures;

const ACTIVITY_TEMPLATES = Object.keys(activityContentFixtures) as ActivityTemplate[];

const CANVAS_LOAD_TIMEOUT_MS = 10_000;

const SCREENS: [string, () => PlayableLibraryStep][] = [
  ["hook", () => teachingStep("hook")],
  ["explanation", () => teachingStep("explanation")],
  ["worked example", () => teachingStep("workedExample")],
  ["check", () => teachingStep("check")],
  ["typed answer", () => teachingStep("typedAnswer")],
  ["spoken answer", spokenAnswerStep],
  ["summary", () => teachingStep("summary")],
  ["challenge", () => teachingStep("challenge")],
  ["vocabulary", () => languageStep("vocabulary")],
  ["translation", () => languageStep("translation")],
  ["reading", () => languageStep("reading")],
  ["listening", () => languageStep("listening")],
  ["alphabet", () => languageStep("alphabet")],
  ["match columns", () => languageStep("matchColumns")],
  ["fill blank", () => languageStep("fillBlank")],
  ["multiple choice", () => languageStep("multipleChoice")],
  ...ACTIVITY_TEMPLATES.map((template): [string, () => PlayableLibraryStep] => [
    `activity ${template}`,
    () => activityStep({ content: activityContentFixtures[template] }),
  ]),
];

const FEEDBACK_SLOTS: LessonPlayerSlots = {
  reportMenuItem: (target) => <ReportProblemItem screen="lesson-step" target={target} />,
};

const FEEDBACK_ADAPTERS: ContentFeedbackAdapters = {
  getViewerEmail: () => Promise.resolve(null),
  platform: "web",
  sendMessage: () => Promise.resolve(true),
  track: () => null,
};

const RIGHT_TYPED = "It shows where the electron is likely to be";
const RIGHT_OPTION = "Where the electron is most likely to be found";

function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

async function pick(key: string, option: string) {
  await press(key);
  await expect.element(page.getByRole("radio", { name: option })).toBeChecked();
}

async function enterTo(next: Locator) {
  await press("Enter");
  await expect.element(next).toBeVisible();
}

async function scanLayer({ button, layer }: { button: string; layer: Locator }) {
  const opener = page.getByRole("button", { name: button });

  await tabTo(opener);
  await press("Enter");
  await expect.element(layer).toBeVisible();
  await expectAccessibleScreen(button);
  await press("Escape");
  await expect.element(layer).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /^Next/u })).toHaveFocus();
}

function openHostedLesson() {
  const typedAnswer = teachingStep("typedAnswer");

  const lesson = buildLesson(
    [
      teachingStep("hook"),
      teachingStep("explanation"),
      teachingStep("check"),
      typedAnswer,
      teachingStep("summary"),
    ],
    { summaryIdeas: playableStepContent.summary.ideas.map((idea) => idea.text) },
  );

  const graded = buildAdapters(lesson);
  const typed = acceptedAnswerCheck(typedAnswer);

  const checkStep: LessonPlayerAdapters["checkStep"] = (input) =>
    input.answer.kind === "typedAnswer" ? typed(input) : graded.checkStep(input);

  stubTutorApi({ lesson });

  renderLessonPlayer({
    adapters: buildAdapters(lesson, { checkStep }),
    children: (
      <ContentFeedbackProvider adapters={FEEDBACK_ADAPTERS}>
        <LessonPlayerShell />
      </ContentFeedbackProvider>
    ),
    lesson,
    slots: FEEDBACK_SLOTS,
    tutor: buildTutor(),
  });
}

describe("lesson player accessibility", () => {
  it.each(SCREENS)("%s", async (name, buildStep) => {
    renderLessonPlayer({ lesson: buildLesson([buildStep()]) });
    await expect.element(page.getByRole("main", { name: "Lesson content" })).toBeVisible();

    await expect
      .poll(() => document.querySelector("[data-slot='activity-canvas-skeleton']"), {
        timeout: CANVAS_LOAD_TIMEOUT_MS,
      })
      .toBeNull();

    await expectAccessibleScreen(name);
  });

  it("a lesson played by keyboard, in each state", async () => {
    await atViewport(TABLET_PORTRAIT, async () => {
      openHostedLesson();

      await expect.element(page.getByText("Guess first")).toBeVisible();
      await pick("3", "No");
      await enterTo(verdict("Good guess!"));
      await expectAccessibleScreen("a guess's reveal");
      await enterTo(page.getByText("A cloud, not a little ball"));

      await scanLayer({ button: "Ask Pip", layer: page.getByRole("dialog", { name: "Pip" }) });

      await scanLayer({ button: "Screen options", layer: page.getByRole("menu") });

      await enterTo(page.getByText('What does the electron "cloud" show?'));
      await pick("1", "The electron's exact path");
      await enterTo(verdict("Not quite"));
      await expectAccessibleScreen("a wrong answer's feedback");

      const typed = page.getByRole("textbox", {
        name: "In your own words: why is the electron drawn as a cloud?",
      });

      await enterTo(typed);
      await tabTo(typed);
      await userEvent.keyboard(RIGHT_TYPED);
      await tabTo(page.getByRole("button", { name: /^Check/u }));
      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await expectAccessibleScreen("a written answer's grade");
      await enterTo(page.getByRole("heading", { name: "Summary" }));

      await enterTo(page.getByText('What does the electron "cloud" show?'));
      await pick("2", RIGHT_OPTION);
      await enterTo(verdict("Correct!"));
      await enterTo(page.getByRole("heading", { level: 2, name: "Lesson complete" }));
      await expectAccessibleScreen("the completion moment");
    });
  });
});
