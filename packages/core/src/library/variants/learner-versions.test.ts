import { prisma } from "@zoonk/db";
import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { describe, expect, it, vi } from "vitest";
import { lessonRunFixture } from "../../lesson-player/_test-utils/lesson-run-fixture";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../../lesson-player/check-lesson-step";
import { type PlayableLibraryStep } from "../../lesson-player/contract";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { pickToolVersion } from "./learner-versions";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const SPREADSHEET = "Spreadsheet (Google Sheets or Excel)";

const toolExplanation = {
  text: "In a spreadsheet, `=AVERAGE(B2:B9)` gives the mean of the scores in B2 to B9.",
  title: "The mean in a spreadsheet",
};

/** A check whose right answer differs from the shared one, so grading shows which was used. */
const toolCheck = {
  options: [
    { id: "sum", isCorrect: false, reason: "SUM adds them up.", text: "=SUM(B2:B9)" },
    { id: "average", isCorrect: true, reason: "AVERAGE gives the mean.", text: "=AVERAGE(B2:B9)" },
  ],
  question: "Which formula gives the mean of B2 to B9?",
};

type Choice = "have" | "none" | "setup";

/**
 * A learner whose plan has the lesson in a chapter that uses a spreadsheet, having answered
 * `choice` for it on the "You'll use" card, and whose goal is a work goal in `field`.
 */
async function setupLearner({
  choice,
  field = null,
}: {
  choice: Choice | null;
  field?: string | null;
}) {
  const setup = await setupPlayableLesson({ steps: ["explanation", "check", "challenge"] });

  const [goal, chapter] = await Promise.all([
    goalFixture({
      details: field ? { field, purpose: "work", role: "Nurse" } : {},
      userId: setup.user.id,
    }),
    libraryChapterFixture({ tools: [{ essential: true, name: SPREADSHEET }] }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    settings: choice ? { tools: [{ choice, name: SPREADSHEET }] } : {},
  });

  await planItemFixture({ chapterId: chapter.id, lessonId: setup.lesson.id, planId: plan.id });

  return setup;
}

/** A served teaching screen's content; language exercises carry theirs differently. */
function contentOf(steps: PlayableLibraryStep[], kind: string): unknown {
  const step = stepOfKind(steps, kind);
  return "content" in step ? step.content : null;
}

async function readServed(lessonId: string) {
  const result = await getPlayableLibraryLesson({ lessonId });
  return result?.status === "ready" ? result.lesson.steps : [];
}

describe(pickToolVersion, () => {
  const tools = [
    { essential: false, name: "A terminal" },
    { essential: true, name: SPREADSHEET },
  ];

  it("uses the tool's version for a learner who has it or sets it up", () => {
    expect(
      pickToolVersion({
        choices: [{ choice: "have", name: "spreadsheet", setupSkillId: null, system: null }],
        tools,
      }),
    ).toStrictEqual({ key: "spreadsheet", label: SPREADSHEET });
  });

  it("uses the no-install version when the learner goes without it", () => {
    expect(
      pickToolVersion({
        choices: [{ choice: "none", name: SPREADSHEET, setupSkillId: null, system: null }],
        tools,
      }),
    ).toStrictEqual({ key: "no-install", label: "no-install" });
  });

  it("follows the chapter's essential tool first, and nothing without an answer", () => {
    const choices = [
      { choice: "none" as const, name: "A terminal", setupSkillId: null, system: null },
      { choice: "have" as const, name: SPREADSHEET, setupSkillId: null, system: null },
    ];

    expect(pickToolVersion({ choices, tools })?.key).toBe("spreadsheet");
    expect(pickToolVersion({ choices: [], tools })).toBeNull();
  });
});

describe("personal versions of shared lessons", () => {
  it("serves the tool version of a hands-on screen and keeps the rest shared", async () => {
    const { lesson, steps } = await setupLearner({ choice: "have" });
    const explanation = stepOfKind(steps, "explanation");
    const check = stepOfKind(steps, "check");

    await stepVariantFixture({
      content: toolExplanation,
      key: "spreadsheet",
      kind: "tool",
      stepId: explanation.id,
    });

    const served = await readServed(lesson.id);

    expect(stepOfKind(served, "explanation")).toMatchObject({
      content: toolExplanation,
      id: explanation.id,
      image: null,
    });

    expect(contentOf(served, "check")).toStrictEqual(check.content);
  });

  it("serves the no-install version to a learner who installs nothing", async () => {
    const { lesson, steps } = await setupLearner({ choice: "none" });
    const explanation = stepOfKind(steps, "explanation");

    await Promise.all([
      stepVariantFixture({
        content: toolExplanation,
        key: "spreadsheet",
        kind: "tool",
        stepId: explanation.id,
      }),
      stepVariantFixture({
        content: { text: "Here's what the sheet shows.", title: "No install" },
        key: "no-install",
        kind: "tool",
        stepId: explanation.id,
      }),
    ]);

    const served = await readServed(lesson.id);

    expect(contentOf(served, "explanation")).toMatchObject({ title: "No install" });
  });

  it("serves the shared screens until a version is made, and to learners without a choice", async () => {
    const [waiting, unanswered] = await Promise.all([
      setupLearner({ choice: "have" }),
      setupLearner({ choice: null }),
    ]);

    await stepVariantFixture({
      content: toolExplanation,
      key: "spreadsheet",
      kind: "tool",
      stepId: stepOfKind(unanswered.steps, "explanation").id,
    });

    const [waitingSteps, unansweredSteps] = await Promise.all([
      readServed(waiting.lesson.id),
      readServed(unanswered.lesson.id),
    ]);

    expect(contentOf(waitingSteps, "explanation")).toStrictEqual(
      stepOfKind(waiting.steps, "explanation").content,
    );

    expect(contentOf(unansweredSteps, "explanation")).toStrictEqual(
      stepOfKind(unanswered.steps, "explanation").content,
    );
  });

  it("serves the chapter challenge set in the learner's field", async () => {
    const { lesson, steps } = await setupLearner({ choice: null, field: "nursing" });
    const challenge = stepOfKind(steps, "challenge");

    const nursingCase = {
      ...challengeCaseFixture(),
      title: "Is the ward's infection rate really up?",
    };

    await stepVariantFixture({
      content: nursingCase,
      key: "nursing",
      kind: "field",
      stepId: challenge.id,
    });

    const served = await readServed(lesson.id);

    expect(contentOf(served, "challenge")).toMatchObject({ title: nursingCase.title });
  });

  it("grades a check against the version the learner saw", async () => {
    const { lesson, steps, user } = await setupLearner({ choice: "have" });
    const check = stepOfKind(steps, "check");

    await stepVariantFixture({
      content: toolCheck,
      key: "spreadsheet",
      kind: "tool",
      stepId: check.id,
    });

    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

    const result = await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: "average" },
        durationMs: 5000,
        runId: run.id,
        timeZone: "UTC",
      },
      stepId: check.id,
    });

    expect(result).toMatchObject({ result: { isCorrect: true }, status: "checked" });

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { stepId: check.id, userId: user.id },
    });

    expect(attempt.isCorrect).toBe(true);
  });
});
