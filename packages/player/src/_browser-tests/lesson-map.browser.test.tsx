import { type LessonMap } from "@zoonk/core/library/lessons/map";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import {
  buildAdapters,
  renderLessonPlayer,
  runAnswer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RIGHT_OPTION = "Where the electron is most likely to be found";
const WRONG_OPTION = "The electron's exact path";

const NESTED: LessonMap = {
  ideas: [
    { label: "Organism", text: "An organism is one living thing." },
    { label: "Population", text: "A population is one species living in one place." },
  ],
  shape: "nested",
};

function mapHeading() {
  return page.getByRole("main").getByRole("heading", { name: "Lesson map" });
}

function segments(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-segment]")].map(
    (segment) => segment.dataset.segment ?? "",
  );
}

async function answer(option: string, verdict: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

function barButton(name: string) {
  return page.getByRole("button", { exact: true, name });
}

async function next(label = /^Continue/u) {
  await page.getByRole("button", { name: label }).click();
}

describe("the lesson map", () => {
  it("shows once a missed check came back and was answered, goes back to that retry, and saves only on Continue", async () => {
    const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")], {
      summary: NESTED,
    });

    const adapters = buildAdapters(lesson);
    renderLessonPlayer({ adapters, lesson });

    await next(/^Next/u);
    await answer(WRONG_OPTION, "Not quite");
    await next();

    await expect.element(mapHeading()).not.toBeInTheDocument();
    await answer(RIGHT_OPTION, "Correct!");
    await next();

    await expect.element(mapHeading()).toBeVisible();

    await expect
      .element(page.getByText("Each level sits inside the next one."))
      .toBeInTheDocument();

    await expect
      .element(page.getByText("A population is one species living in one place."))
      .toBeVisible();

    expect(segments()).toStrictEqual(["read", "wrong", "right", "current"]);
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Previous screen" }).click();
    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    await next();

    await expect.element(mapHeading()).toBeVisible();
    await next();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.completeLesson).toHaveBeenCalledOnce();
    expect(segments()).toStrictEqual(["read", "wrong", "right", "read"]);
  });

  it("opens on the map when every screen was answered before, and saves only on Continue", async () => {
    const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")], {
      summary: NESTED,
    });

    const answers = [runAnswer({ stepId: lesson.steps[1]?.id ?? "" })];

    const adapters = buildAdapters(lesson, {
      startLesson: vi
        .fn<LessonPlayerAdapters["startLesson"]>()
        .mockResolvedValue(startedRun({ answers })),
    });

    renderLessonPlayer({ adapters, lesson, resume: answers });

    await expect.element(mapHeading()).toBeVisible();
    await expect.element(page.getByText("An organism is one living thing.")).toBeVisible();
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    await expect
      .element(page.getByRole("button", { name: "Previous screen" }))
      .not.toBeInTheDocument();

    await next();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.completeLesson).toHaveBeenCalledOnce();
  });

  it("shows in a study session too, before the session's own moment", async () => {
    const lesson = buildLesson([teachingStep("check")], {
      summary: { ideas: [{ text: "Electrons live in clouds." }], shape: "hub" },
    });

    const adapters = buildAdapters(lesson);

    renderLessonPlayer({ adapters, lesson, slots: { completion: () => <h2>Block done</h2> } });

    await answer(RIGHT_OPTION, "Correct!");
    await next();

    await expect.element(mapHeading()).toBeVisible();
    await expect.element(page.getByText(lesson.title, { exact: true }).last()).toBeVisible();
    await expect.element(page.getByText("Electrons live in clouds.")).toBeVisible();
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    await next();
    await expect.element(page.getByRole("heading", { name: "Block done" })).toBeVisible();
  });

  it('is left out after testing out with "I already know this"', async () => {
    const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")], {
      summary: NESTED,
    });

    renderLessonPlayer({ lesson });

    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "I already know this" }).click();
    await answer(RIGHT_OPTION, "Correct!");
    await next();

    await expect
      .element(page.getByRole("heading", { name: "You already knew this" }))
      .toBeVisible();

    await expect.element(mapHeading()).not.toBeInTheDocument();
  });
});

describe("the opening guess's action bar", () => {
  it("reveals the answer with nothing picked and counts it as nothing", async () => {
    const lesson = buildLesson([teachingStep("hook"), teachingStep("explanation")]);
    const adapters = buildAdapters(lesson);
    renderLessonPlayer({ adapters, lesson });

    await expect.element(page.getByText("Just a guess, it doesn't count")).toBeVisible();

    await expect
      .element(page.getByText("Getting it wrong now helps you remember later."))
      .not.toBeInTheDocument();

    await barButton("I don't know yet").click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "Here's the answer" }))
      .toBeVisible();

    await expect.element(page.getByRole("radio", { name: "No" })).toMatchTextContent(/Correct/u);
    await expect.element(page.getByText("Your guess")).not.toBeInTheDocument();
    await expect.element(barButton("I don't know yet")).not.toBeInTheDocument();
    expect(segments()[0]).toBe("read");

    await next();
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await next();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.checkStep).not.toHaveBeenCalled();
    expect(segments()).toStrictEqual(["read", "read"]);
  });

  it("turns into See the answer while an option is picked, and back when it's unpicked", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("hook"), teachingStep("explanation")]),
    });

    await page.getByRole("radio", { name: "Yes, exactly" }).click();
    await expect.element(barButton("See the answer")).toBeVisible();
    await expect.element(barButton("I don't know yet")).not.toBeInTheDocument();

    await page.getByRole("radio", { name: "Yes, exactly" }).click();
    await expect.element(barButton("I don't know yet")).toBeVisible();

    await page.getByRole("radio", { name: "No" }).click();
    await barButton("See the answer").click();

    await expect.element(page.getByRole("status").filter({ hasText: "Good guess!" })).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "No" })).toMatchTextContent(/Your guess/u);
  });

  it("answers Enter as its button does: reveal with nothing picked, check once picked", async () => {
    const first = renderLessonPlayer({
      lesson: buildLesson([teachingStep("hook"), teachingStep("explanation")]),
    });

    await expect.element(barButton("I don't know yet")).toBeVisible();
    await press("Enter");

    await expect
      .element(page.getByRole("status").filter({ hasText: "Here's the answer" }))
      .toBeVisible();

    first.unmount();

    renderLessonPlayer({
      lesson: buildLesson([teachingStep("hook"), teachingStep("explanation")]),
    });

    await press("3");
    await expect.element(barButton("See the answer")).toBeVisible();
    await press("Enter");
    await expect.element(page.getByRole("status").filter({ hasText: "Good guess!" })).toBeVisible();
  });

  it("resumes past a guess, which records nothing, and keeps the bar's guess actions there", async () => {
    const lesson = buildLesson([
      teachingStep("hook"),
      teachingStep("check"),
      {
        ...teachingStep("explanation"),
        content: { text: "Denser means more likely.", title: "Reading it" },
      },
      teachingStep("check"),
    ]);

    const answers = [runAnswer({ stepId: lesson.steps[1]?.id ?? "" })];

    const adapters = buildAdapters(lesson, {
      startLesson: vi
        .fn<LessonPlayerAdapters["startLesson"]>()
        .mockResolvedValue(startedRun({ answers })),
    });

    renderLessonPlayer({ adapters, lesson, resume: answers });

    await expect.element(page.getByText("Reading it")).toBeVisible();
    await expect.element(page.getByText("Just a guess, it doesn't count")).not.toBeInTheDocument();
  });
});
