import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { inlineImage } from "../_test-utils/activity-player";
import { explanationStep, teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { swipeFrom, tap } from "../_test-utils/touch-screen";

/**
 * Lessons on a phone's touch screen (the touch instance in vitest.config.mts) turn like stories: a
 * quick swipe left reads on and a swipe right goes back, wherever the arrow keys would. A swipe
 * never answers a question, and scrolling, controls and wide tables keep their own gestures.
 */

/** Far past the swipe's threshold, as a quick flick across a phone is. */
const SWIPE_PX = 160;

const FRONTAL = {
  alt: "The brain from the side with the frontal lobe at the front",
  text: "The **frontal lobe** sits behind your forehead. It plans what you do next.",
  title: "The frontal lobe",
};

const OCCIPITAL = {
  alt: "The brain from the side with the occipital lobe at the back",
  text: "The **occipital lobe** sits at the back of your head. It turns light into images.",
  title: "The occipital lobe",
};

/** An explanation that leads with its drawn picture, as lessons about how something looks do. */
function pictured({ alt, text, title }: typeof FRONTAL) {
  return {
    ...explanationStep({ image: { alt, prompt: alt }, text, title }),
    image: inlineImage({ alt }),
  };
}

function heading(text: string) {
  return page.getByRole("heading", { name: text });
}

describe("turning lesson screens with a finger", () => {
  it("swipes left to read on and right to go back, picture first", async () => {
    const lesson = buildLesson([pictured(FRONTAL), pictured(OCCIPITAL), teachingStep("check")]);
    renderLessonPlayer({ lesson });

    await expect.element(page.getByRole("img", { name: FRONTAL.alt })).toBeVisible();
    await swipeFrom(page.getByText("It plans what you do next."), { x: -SWIPE_PX });

    await expect.element(heading(OCCIPITAL.title)).toBeVisible();
    await expect.element(page.getByRole("img", { name: OCCIPITAL.alt })).toBeVisible();
    await expect.element(heading(FRONTAL.title)).not.toBeInTheDocument();

    // A swipe on the picture itself turns too: the whole screen is the page.
    await swipeFrom(page.getByRole("img", { name: OCCIPITAL.alt }), { x: SWIPE_PX });
    await expect.element(heading(FRONTAL.title)).toBeVisible();
  });

  it("never answers, checks or skips a question with a swipe", async () => {
    const lesson = buildLesson([pictured(FRONTAL), teachingStep("check")]);
    const adapters = buildAdapters(lesson);
    renderLessonPlayer({ adapters, lesson });

    await swipeFrom(page.getByText("It plans what you do next."), { x: -SWIPE_PX });

    const question = page.getByRole("heading", { level: 2 }).last();
    await expect.element(page.getByRole("radiogroup")).toBeVisible();
    const questionText = question.element().textContent ?? "";

    await swipeFrom(question, { x: -SWIPE_PX });

    await expect.element(page.getByRole("heading", { name: questionText })).toBeVisible();
    await expect.element(page.getByRole("button", { name: /^Check/u })).toBeDisabled();
    expect(adapters.checkStep).not.toHaveBeenCalled();

    // Going back is still a swipe away, as it's an arrow key away.
    await swipeFrom(question, { x: SWIPE_PX });
    await expect.element(heading(FRONTAL.title)).toBeVisible();
  });

  it("goes on with a swipe once a question's result shows, as Continue does", async () => {
    const lesson = buildLesson([teachingStep("check"), pictured(OCCIPITAL)]);
    renderLessonPlayer({ lesson });

    await tap(page.getByRole("radio").first());
    await tap(page.getByRole("button", { name: /^Check/u }));

    const result = page.getByRole("button", { name: /^Continue/u });
    await expect.element(result).toBeVisible();

    await swipeFrom(page.getByRole("radiogroup"), { x: -SWIPE_PX });
    await expect.element(heading(OCCIPITAL.title)).toBeVisible();
  });

  it("scrolls a long screen up and down without turning it", async () => {
    const long = Array.from(
      { length: 12 },
      (_, index) => `Sentence ${index + 1} explains one more detail of how light reaches the eye.`,
    ).join(" ");

    const lesson = buildLesson([
      explanationStep({ text: long, title: "How light reaches the eye" }),
      pictured(OCCIPITAL),
    ]);

    renderLessonPlayer({ lesson });

    // A thumb scrolling up drifts sideways too, past what a straight swipe needs.
    await swipeFrom(page.getByText(/Sentence 1 explains/u), { x: -60, y: -220 });

    await expect.element(heading("How light reaches the eye")).toBeInTheDocument();
    await expect.element(heading(OCCIPITAL.title)).not.toBeInTheDocument();
  });

  it("leaves a wide table's sideways swipe to the table", async () => {
    const table = [
      "| Planet | Distance from the Sun | Length of a year | Moons | Surface |",
      "|---|---:|---:|---:|---|",
      "| Mercury | 58 million km | 88 days | 0 | Rocky and cratered |",
      "| Mars | 228 million km | 687 days | 2 | Rocky and dusty red |",
    ].join("\n");

    const lesson = buildLesson([
      explanationStep({ text: `Compare two planets:\n\n${table}`, title: "Two rocky planets" }),
      pictured(OCCIPITAL),
    ]);

    renderLessonPlayer({ lesson });

    await swipeFrom(page.getByRole("cell", { name: "Mercury" }), { x: -SWIPE_PX });

    await expect.element(heading("Two rocky planets")).toBeVisible();
    await expect.element(heading(OCCIPITAL.title)).not.toBeInTheDocument();
  });

  it("fetches the next screen's picture while this one is read", async () => {
    const next = pictured(OCCIPITAL);
    const lesson = buildLesson([pictured(FRONTAL), next]);
    renderLessonPlayer({ lesson });

    await expect.element(heading(FRONTAL.title)).toBeVisible();

    // Loaded in the background, out of sight and out of the screen reader's way.
    const waiting = [...document.querySelectorAll("img")].filter(
      (image) => image.getAttribute("src") === next.image.url,
    );

    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.getAttribute("alt")).toBe("");
    expect(waiting[0]?.getAttribute("loading")).toBe("eager");
    await expect.element(page.getByRole("img", { name: OCCIPITAL.alt })).not.toBeInTheDocument();
  });
});
