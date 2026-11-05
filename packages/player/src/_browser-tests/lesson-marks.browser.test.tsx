import { type LessonMarks } from "@zoonk/core/lesson-player/playable-lesson";
import { type LessonIcon } from "@zoonk/core/library/icons/contract";
import { type LessonMap } from "@zoonk/core/library/lessons/map";
import { type StepMarks } from "@zoonk/core/library/marks/contract";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, teachingStep } from "../preview/preview-steps";

function inlineIcon(letter: string): LessonIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="44" fill="#fde68a" /><text x="48" y="62" font-size="40" text-anchor="middle">${letter}</text></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { smallUrl: url, url };
}

const RIGHT_OPTION = "Where the electron is most likely to be found";
const SCENE = "You toss a ball and can always say where it is. An electron isn't like that.";

const MAP: LessonMap = {
  ideas: [
    {
      about: "What the electron does around the nucleus",
      icon: inlineIcon("C"),
      label: "A cloud, not an orbit",
      text: "The electron spreads around the nucleus as a cloud of chances, not along a path.",
    },
    {
      about: "How to read the cloud",
      icon: inlineIcon("R"),
      label: "Reading the cloud",
      text: "The darker the cloud, the likelier the electron is there.",
    },
  ],
  shape: "hub",
};

function marks(fields: Partial<StepMarks>): StepMarks {
  return { example: null, icon: null, ideaIndex: null, underline: null, ...fields };
}

function lesson({ summary = MAP, tagged = true }: { summary?: LessonMap; tagged?: boolean } = {}) {
  return buildLesson(
    [
      contentStep("hook", { content: { text: SCENE, variant: "text" } }),
      teachingStep("explanation", {
        marks: tagged
          ? marks({
              example: "The electron doesn't circle the nucleus like a planet.",
              icon: inlineIcon("E"),
              ideaIndex: 0,
              underline: "a map of where it might be",
            })
          : null,
      }),
      teachingStep("check", { marks: tagged ? marks({ ideaIndex: 1 }) : null }),
    ],
    { summary },
  );
}

function strip() {
  return page.getByRole("main").getByText(/^Idea \d of \d$/u);
}

function shownIdeas() {
  return [...document.querySelectorAll('[data-slot="orientation-strip"]')]
    .filter((shown) => shown.checkVisibility())
    .map((shown) => shown.querySelector("p")?.textContent);
}

function underlined() {
  return [...document.querySelectorAll('[data-slot="underline"]')].map((mark) => mark.textContent);
}

async function next() {
  await page.getByRole("button", { name: /^Next/u }).click();
}

describe("lesson marks", () => {
  it("opens on the lesson's ideas, each saying what it covers without its answer", async () => {
    const { onExit } = renderLessonPlayer({ lesson: lesson() });

    await expect.element(page.getByText("2 ideas to discover in this lesson")).toBeVisible();
    await expect.element(page.getByText("A cloud, not an orbit")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Idea 2 of 2" }).click();
    const about = page.getByRole("dialog", { name: "Idea 2 of 2" });
    await expect.element(about).toMatchTextContent("How to read the cloud");

    await userEvent.keyboard("{Escape}");
    await expect.element(about).not.toBeInTheDocument();
    await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
    await expect.element(page.getByText(SCENE)).toBeVisible();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("marks an explanation's idea, main point, example and new term without changing its words", async () => {
    renderLessonPlayer({ lesson: lesson() });
    await next();

    await expect.element(strip()).toHaveTextContent("Idea 1 of 2");
    await expect.element(page.getByText("A cloud, not an orbit")).toBeVisible();
    expect(underlined()).toStrictEqual(["a map of where it might be"]);

    await expect.element(page.getByText("Example", { exact: true })).toBeVisible();

    await expect
      .element(
        page.getByText("The electron doesn't circle the nucleus like a planet.", { exact: true }),
      )
      .toBeVisible();

    await expect
      .element(
        page.getByText(
          "It spreads out into a cloud of possibilities: a map of where it might be.",
          { exact: true },
        ),
      )
      .toBeVisible();

    await expect.element(page.getByText("cloud of possibilities", { exact: true })).toBeVisible();

    expect(page.getByRole("main").getByRole("img").elements()).toHaveLength(0);
  });

  it("shows the idea a question belongs to, then the lesson map around the lesson's title", async () => {
    const tagged = lesson();
    renderLessonPlayer({ lesson: tagged });
    await next();
    await next();

    await expect.element(strip()).toHaveTextContent("Idea 2 of 2");
    await expect.element(page.getByText("Reading the cloud")).toBeVisible();

    await page.getByRole("radio", { name: RIGHT_OPTION }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();

    const map = page.getByRole("main");
    await expect.element(map.getByRole("heading", { name: "Lesson map" })).toBeVisible();
    await expect.element(map.getByText(tagged.title, { exact: true })).toBeVisible();

    const ideas = map.getByRole("listitem");
    expect(ideas.elements()).toHaveLength(MAP.ideas.length);

    await expect
      .element(ideas.first())
      .toMatchTextContent(/A cloud, not an orbit.*as a cloud of chances/u);

    await expect
      .element(ideas.last())
      .toMatchTextContent(/Reading the cloud.*The darker the cloud/u);
  });

  it("underlines a main point that runs through a new term", async () => {
    const explanation = teachingStep("explanation", {
      marks: marks({ ideaIndex: 0, underline: "a cloud of possibilities: a map" }),
    });

    renderLessonPlayer({ lesson: buildLesson([explanation], { summary: MAP }) });

    await expect.element(page.getByText("cloud of possibilities", { exact: true })).toBeVisible();
    expect(underlined()).toStrictEqual(["a cloud of possibilities: a map"]);
  });

  it("fills in marks that arrive after the lesson opened, only the underline on the screen being read", async () => {
    const tagged = lesson();
    const [scene, explanation, check] = tagged.steps;
    const arrival = Promise.withResolvers<LessonMarks>();
    const getLessonMarks = vi.fn(() => arrival.promise);

    const opened = buildLesson(
      tagged.steps.map((step) => ({ ...step, marks: null })),
      {
        marksPending: true,
        summary: { ...MAP, ideas: MAP.ideas.map(({ label, text }) => ({ label, text })) },
      },
    );

    renderLessonPlayer({
      adapters: { ...buildAdapters(opened), getLessonMarks },
      lesson: { ...opened, id: tagged.id },
    });

    await next();
    await expect.element(page.getByText("It spreads out into", { exact: false })).toBeVisible();

    arrival.resolve({
      marksPending: false,
      steps: [scene, explanation, check].flatMap((step) =>
        step && "marks" in step ? [{ marks: step.marks, stepId: step.id }] : [],
      ),
      summary: MAP,
    });

    await expect.poll(underlined).toStrictEqual(["a map of where it might be"]);
    await expect.element(strip()).not.toBeInTheDocument();
    await expect.element(page.getByText("Example", { exact: true })).not.toBeInTheDocument();

    await next();
    await expect.element(strip()).toHaveTextContent("Idea 2 of 2");

    await page.getByRole("button", { name: "Previous screen" }).click();
    await expect.poll(shownIdeas).toStrictEqual(["Idea 1 of 2"]);
    expect(underlined()).toStrictEqual(["a map of where it might be"]);

    await page.getByRole("button", { name: "Previous screen" }).click();
    await expect.element(page.getByText("2 ideas to discover in this lesson")).toBeVisible();
  });

  it("keeps reading marks after a few failed reads, within the screens' picture wait", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const tagged = lesson();

    const getLessonMarks = vi
      .fn<() => Promise<LessonMarks | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ marksPending: false, steps: [], summary: MAP });

    const opened = buildLesson(tagged.steps, {
      marksPending: true,
      summary: { ...MAP, ideas: MAP.ideas.map(({ label, text }) => ({ label, text })) },
    });

    renderLessonPlayer({ adapters: { ...buildAdapters(opened), getLessonMarks }, lesson: opened });
    const openingMap = page.getByText("2 ideas to discover in this lesson");

    await expect
      .poll(async () => {
        await vi.advanceTimersByTimeAsync(4000);
        return openingMap.query();
      })
      .not.toBeNull();
  });

  it("leaves an example inside a numbered list unframed, so the list keeps counting", async () => {
    const steps = "1. Heat the water.\n2. Add the salt.\n3. Stir until it dissolves.";

    const explanation = contentStep("explanation", {
      content: { text: steps },
      marks: marks({
        example: "2. Add the salt.",
        icon: inlineIcon("S"),
        ideaIndex: 0,
        underline: "Add the salt",
      }),
    });

    renderLessonPlayer({ lesson: buildLesson([explanation], { summary: MAP }) });
    await expect.element(page.getByText("Add the salt.")).toBeVisible();

    await expect.element(page.getByText("Example", { exact: true })).not.toBeInTheDocument();
    expect(page.getByRole("main").getByRole("listitem").elements()).toHaveLength(3);
    expect(underlined()).toStrictEqual(["Add the salt"]);

    const cornerIcons = document.querySelectorAll(
      '[data-slot="lesson-text"] [data-slot="lesson-icon"]',
    );

    expect(cornerIcons).toHaveLength(1);
  });

  it("plays a lesson written before marks as plain text", async () => {
    const plainMap = { ...MAP, ideas: MAP.ideas.map(({ label, text }) => ({ label, text })) };
    renderLessonPlayer({ lesson: lesson({ summary: plainMap, tagged: false }) });

    await expect.element(page.getByText(SCENE)).toBeVisible();
    await expect.element(page.getByText(/ideas to discover/u)).not.toBeInTheDocument();
    await next();

    const text = playableStepContent.explanation.text.replaceAll("**", "");
    await expect.element(page.getByText(text, { exact: true })).toBeVisible();

    await expect.element(strip()).not.toBeInTheDocument();
    await expect.element(page.getByText("Example", { exact: true })).not.toBeInTheDocument();
    expect(underlined()).toStrictEqual([]);
  });
});
