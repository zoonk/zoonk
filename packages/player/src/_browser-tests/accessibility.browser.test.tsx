import { type ContentFeedbackAdapters, ContentFeedbackProvider } from "@zoonk/learn/feedback";
import { ContentVoteMenuItems } from "@zoonk/learn/feedback/menu-items";
import { ContentThumbs, ContentThumbsRow } from "@zoonk/learn/feedback/thumbs";
import { listMovingAnimations } from "@zoonk/testing/accessibility/motion";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { press } from "../_test-utils/activity-player";
import { onDevice } from "../_test-utils/device-media";
import { tabTo } from "../_test-utils/keyboard";
import { languageStep } from "../_test-utils/language-steps";
import { activityStep, spokenAnswerStep, teachingStep } from "../_test-utils/lesson-steps";
import {
  type PlayerMode,
  acceptedAnswerCheck,
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { buildTutor, stubTutorApi } from "../_test-utils/tutor-api";
import { type LessonPlayerSlots } from "../lesson/lesson-player-context";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "../lesson/lesson-player-types";

/**
 * Accessibility of the lesson player, in Focus (light and dark) and Fun: every kind of screen and
 * all 43 activity templates as the first screen of a lesson, then a lesson played by keyboard and
 * scanned in each state it reaches (an answer's feedback, the tutor, the screen's menu, the end),
 * and Fun's motion calming down when the device asks for less.
 */

const MODES: PlayerMode[] = ["focus", "fun"];

type ActivityTemplate = keyof typeof activityContentFixtures;

const ACTIVITY_TEMPLATES = Object.keys(activityContentFixtures) as ActivityTemplate[];

/** Every screen a lesson can open on, by name, built the way the server serves it. */
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

/**
 * The feedback an app puts in a lesson, as the web app does: votes in the screen's menu, thumbs
 * under an answer's why and at the end. Nothing is saved anywhere.
 */
const FEEDBACK_SLOTS: LessonPlayerSlots = {
  answerFeedback: (target) => <ContentThumbs target={target} />,
  completionFeedback: (target) => <ContentThumbsRow className="self-center" target={target} />,
  screenMenuItems: (target) => <ContentVoteMenuItems screen="lesson-step" target={target} />,
};

const FEEDBACK_ADAPTERS: ContentFeedbackAdapters = {
  getViewerEmail: () => Promise.resolve(null),
  platform: "web",
  readVote: () => Promise.resolve(null),
  sendMessage: () => Promise.resolve(true),
  track: () => null,
  vote: () => Promise.resolve(true),
};

const RIGHT_TYPED = "It shows where the electron is likely to be";
const RIGHT_OPTION = "Where the electron is most likely to be found";

/** A screen's verdict, as the player announces it. */
function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

/** Picks an option with its number key. */
async function pick(key: string, option: string) {
  await press(key);
  await expect.element(page.getByRole("radio", { name: option })).toBeChecked();
}

/** Enter runs the screen's main action (check, then continue) when focus isn't on a control. */
async function enterTo(next: Locator) {
  await press("Enter");
  await expect.element(next).toBeVisible();
}

/**
 * Opens a layer with its button by keyboard and scans it, then Escape closes only the layer and
 * puts focus back on its button.
 */
async function scanLayer({ button, layer }: { button: string; layer: Locator }) {
  const opener = page.getByRole("button", { name: button });

  await tabTo(opener);
  await press("Enter");
  await expect.element(layer).toBeVisible();
  await expectAccessibleScreen(button);
  await press("Escape");
  await expect.element(layer).not.toBeInTheDocument();
  await expect.element(opener).toHaveFocus();
}

/**
 * A lesson with every kind of feedback (a guess, a check answered wrong that comes back at the end,
 * a written answer the server accepts) and the summary, hosted as an app hosts it: with the tutor,
 * the app's feedback and the summary card in the screen's menu.
 */
function openHostedLesson(mode: PlayerMode) {
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
    mode,
    slots: FEEDBACK_SLOTS,
    tutor: buildTutor(),
  });
}

/** Answers a check right with the mouse, as the paper flips to its result. */
async function answerRight() {
  await page.getByRole("radio", { name: RIGHT_OPTION }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(verdict("Correct!")).toBeVisible();
}

/** The animations the paper itself runs, by name. */
function paperAnimations() {
  return document
    .querySelector('[data-slot="fun-paper"]')
    ?.getAnimations()
    .map((animation) => ("animationName" in animation ? String(animation.animationName) : ""));
}

describe("lesson player accessibility", () => {
  describe.each(MODES)("in %s", (mode) => {
    it.each(SCREENS)("%s", async (name, buildStep) => {
      renderLessonPlayer({ lesson: buildLesson([buildStep()]), mode });
      await expect.element(page.getByRole("main", { name: "Lesson content" })).toBeVisible();
      await expectAccessibleScreen(name);
    });

    it("a lesson played by keyboard, in each state", async () => {
      openHostedLesson(mode);

      await expect.element(page.getByText("Guess first · no points")).toBeVisible();
      await pick("3", "No");
      await enterTo(verdict("Good guess!"));
      await expectAccessibleScreen("a guess's reveal");
      await enterTo(page.getByText("A cloud, not a little ball"));

      await scanLayer({
        button: "Ask a question",
        layer: page.getByRole("dialog", { name: "Ask questions" }),
      });

      await scanLayer({ button: "Screen options", layer: page.getByRole("menu") });

      // Focus is back on the menu's button, where Enter would reopen it, so it moves on to Next.
      await tabTo(page.getByRole("button", { name: /^Next/u }));
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

      // The check answered wrong comes back once at the end; this time it's answered right.
      await enterTo(page.getByText('What does the electron "cloud" show?'));
      await pick("2", RIGHT_OPTION);
      await enterTo(verdict("Correct!"));
      await enterTo(page.getByRole("heading", { level: 2, name: "Lesson complete" }));
      await expectAccessibleScreen("the completion moment");
    });
  });

  it("Fun's paper flips to its result, and fades instead with reduced motion", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("check"), teachingStep("check")]),
      mode: "fun",
    });

    await answerRight();

    await expect
      .poll(() => listMovingAnimations())
      .toContainEqual(expect.stringContaining("fun-flip"));

    await page.getByRole("button", { name: /^Continue/u }).click();

    await onDevice({ reducedMotion: "reduce" }, async () => {
      await answerRight();
      await expect.poll(() => paperAnimations()).toContain("fun-fade-in");
      expect(listMovingAnimations()).toStrictEqual([]);
    });
  });
});
