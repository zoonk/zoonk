import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { swipeFrom, tap } from "../_test-utils/touch-screen";
import { getPreviewEntry } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep, inlineImage, teachingStep } from "../preview/preview-steps";

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

function pictured({ alt, text, title }: typeof FRONTAL) {
  return {
    ...explanationStep({ image: { alt, prompt: alt }, text, title }),
    image: inlineImage({ alt }),
  };
}

function heading(text: string) {
  return page.getByRole("heading", { name: text });
}

function previewScreen(id: string) {
  const entry = getPreviewEntry(id);

  if (!entry) {
    throw new Error(`The preview catalog has no ${id} screen.`);
  }

  return entry.screen("answering");
}

const CONTROLS = [
  {
    control: () => page.getByRole("group", { name: "Word bank" }).getByRole("button").first(),
    kind: "a word to tap",
    screen: "language-reading",
    text: () => page.getByText("Translate", { exact: true }),
  },
  {
    control: () => page.getByRole("slider"),
    kind: "a slider",
    screen: "activity-numberLine",
    text: () => page.getByText("By noon it's 8 degrees warmer."),
  },
  {
    control: () =>
      page.getByRole("list", { name: "Steps, in your order" }).getByRole("button").first(),
    kind: "a step to drag",
    screen: "activity-processOrder",
    text: () => page.getByText("How does a leaf turn light into sugar?"),
  },
  {
    control: () => page.getByRole("textbox"),
    kind: "a text field",
    screen: "typed-answer",
    text: () => page.getByRole("heading", { name: "why is the electron drawn as a cloud?" }),
  },
] as const;

function sidewaysScroller(element: Element): Element | null {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const { overflowX } = getComputedStyle(node);

    if (overflowX === "auto" || overflowX === "scroll") {
      return node;
    }
  }

  return null;
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

    await swipeFrom(page.getByRole("img", { name: OCCIPITAL.alt }), { x: SWIPE_PX });
    await expect.element(heading(FRONTAL.title)).toBeVisible();
  });

  it("turns on a quick flick the page reads late, as a busy phone does", async () => {
    const lesson = buildLesson([pictured(FRONTAL), pictured(OCCIPITAL)]);
    renderLessonPlayer({ lesson });

    await swipeFrom(page.getByText("It plans what you do next."), {
      liftReadAfterMs: 1000,
      x: -SWIPE_PX,
    });

    await expect.element(heading(OCCIPITAL.title)).toBeVisible();
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

    await swipeFrom(page.getByText(/Sentence 1 explains/u), { x: -60, y: -220 });

    await expect.element(heading("How light reaches the eye")).toBeInTheDocument();
    await expect.element(heading(OCCIPITAL.title)).not.toBeInTheDocument();
  });

  it.each(CONTROLS)(
    "leaves a swipe that starts on $kind to it",
    async ({ control, screen, text }) => {
      renderLessonPlayer({ lesson: buildLesson([pictured(FRONTAL), previewScreen(screen)]) });
      await swipeFrom(page.getByText("It plans what you do next."), { x: -SWIPE_PX });

      await swipeFrom(control(), { x: SWIPE_PX });
      await expect.element(text()).toBeVisible();
      await expect.element(heading(FRONTAL.title)).not.toBeInTheDocument();

      await swipeFrom(text(), { x: SWIPE_PX });
      await expect.element(heading(FRONTAL.title)).toBeVisible();
    },
  );

  it("leaves a wide table's sideways swipe to the table", async () => {
    const table = [
      "| Planet | Distance from the Sun | Length of a year | Moons | Surface | Atmosphere | Temperature | Magnetosphere |",
      "|---|---:|---:|---:|---|---|---|---|",
      "| Mercury | 58 million km | 88 days | 0 | Cratered | Negligible | Scorching | Weak |",
      "| Mars | 228 million km | 687 days | 2 | Dusty | Thin | Freezing | Vanished |",
    ].join("\n");

    const lesson = buildLesson([
      explanationStep({ text: `Compare two planets:\n\n${table}`, title: "Two rocky planets" }),
      pictured(OCCIPITAL),
    ]);

    renderLessonPlayer({ lesson });

    const mercury = page.getByRole("cell", { name: "Mercury" });
    await expect.element(mercury).toBeVisible();

    const scroller = sidewaysScroller(mercury.element());
    expect(scroller && scroller.scrollWidth > scroller.clientWidth).toBe(true);

    await swipeFrom(mercury, { x: -SWIPE_PX });

    await expect.element(heading("Two rocky planets")).toBeVisible();
    await expect.element(heading(OCCIPITAL.title)).not.toBeInTheDocument();
  });

  it("fetches the next screen's picture while this one is read", async () => {
    const next = pictured(OCCIPITAL);
    const lesson = buildLesson([pictured(FRONTAL), next]);
    renderLessonPlayer({ lesson });

    await expect.element(heading(FRONTAL.title)).toBeVisible();

    const waiting = [...document.querySelectorAll("img")].filter(
      (image) => image.getAttribute("src") === next.image.url,
    );

    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.getAttribute("alt")).toBe("");
    expect(waiting[0]?.getAttribute("loading")).toBe("eager");
    await expect.element(page.getByRole("img", { name: OCCIPITAL.alt })).not.toBeInTheDocument();
  });
});
