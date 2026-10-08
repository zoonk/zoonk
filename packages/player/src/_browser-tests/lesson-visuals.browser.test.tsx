import { type LessonVisual } from "@zoonk/core/library/steps/contract";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { expectCount, inlineImage } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";

/**
 * A screen that points at something to see shows it: a table written in its text, a chart or a
 * timeline drawn from its data, and a picture, waited for while it's being drawn. Quoted words in
 * angle quotes read as italics.
 */

const PHONE = { height: 812, width: 375 };

const LETTERS_CHART: LessonVisual = {
  axisStart: null,
  categories: ["Maio", "Junho", "Julho"],
  categoryLabel: "Mês",
  chart: "bar",
  kind: "chart",
  series: [{ name: "Ofícios respondidos", values: [35, 36, 40] }],
  source: null,
  title: "Ofícios respondidos por mês",
  unit: null,
  valueLabel: "Ofícios",
};

const LAW_TIMELINE: LessonVisual = {
  events: [
    { date: "1988", detail: "Promulgada em 5 de outubro.", label: "Constituição Federal" },
    { date: "1990", detail: null, label: "Lei nº 8.112, dos servidores federais" },
  ],
  kind: "timeline",
  title: "Leis que organizam o serviço público",
};

function check(content: object) {
  const base = teachingStep("check");
  return { ...base, content: { ...base.content, ...content } };
}

describe("lesson visuals", () => {
  it("shows a table written in the screen's text as a table, with angle-quoted words in italics", async () => {
    const lesson = buildLesson([
      check({
        context:
          "Lídia anotou os ofícios no quadro a seguir:\n\n| Mês | Recebidos |\n|---|---:|\n| Maio | 40 |\n| Junho | 30 |\n\nA legenda «Junho teve menos» combina?",
      }),
    ]);

    renderLessonPlayer({ lesson });

    const table = page.getByRole("table");
    await expect.element(table.getByRole("columnheader", { name: "Recebidos" })).toBeVisible();
    await expect.element(table.getByRole("cell", { name: "30" })).toBeVisible();
    await expect.element(page.getByText("|---|")).not.toBeInTheDocument();

    const quoted = page.getByText("Junho teve menos", { exact: true });
    await expect.element(quoted).toBeVisible();
    expect(quoted.element().tagName).toBe("EM");
    await expect.element(page.getByText("«", { exact: false })).not.toBeInTheDocument();
  });

  it("shows a guess's data table above its question", async () => {
    const hook = teachingStep("hook");

    if (hook.content.variant !== "guess") {
      throw new Error("The shared hook fixture is a guess.");
    }

    const lesson = buildLesson([
      {
        ...hook,
        content: {
          ...hook.content,
          question:
            "Um setor anotou os ofícios que recebeu:\n\n| Mês | Recebidos |\n| --- | ---: |\n| Maio | 40 |\n| Junho | 30 |\n\nEm qual mês recebeu menos?",
        },
      },
    ]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByRole("table")).toBeVisible();

    await expect
      .element(page.getByRole("heading", { name: "Em qual mês recebeu menos?" }))
      .toBeVisible();
  });

  it("draws a chart from its data, with every value for screen readers", async () => {
    const explanation = teachingStep("explanation");

    const lesson = buildLesson([
      { ...explanation, content: { ...explanation.content, visual: LETTERS_CHART } },
    ]);

    await atViewport(PHONE, async () => {
      renderLessonPlayer({ lesson });

      const chart = page.getByRole("figure", { name: "Ofícios respondidos por mês" });
      await expect.element(chart).toBeVisible();
      await expect.element(chart.getByRole("rowheader", { name: "Junho" })).toBeInTheDocument();
      await expect.element(chart.getByRole("cell", { name: "36" })).toBeInTheDocument();

      // Each bar carries its value, since questions ask about exact numbers.
      expect(chart.element().querySelectorAll("rect")).toHaveLength(3);
      await expectAccessibleScreen("an explanation with a chart");
    });
  });

  it("labels every day of a line chart on a phone, breaking long names over two lines", async () => {
    const days: LessonVisual = {
      ...LETTERS_CHART,
      axisStart: 0,
      categories: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira"],
      chart: "line",
      series: [{ name: "Pedidos", values: [3, 7, 7, 4] }],
      title: "Pedidos de Renan",
    };

    await atViewport(PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson([check({ visual: days })]) });

      const chart = page.getByRole("figure", { name: days.title });
      await expect.element(chart).toBeVisible();

      const labels = [...chart.element().querySelectorAll("svg text")].map(
        (text) => text.textContent,
      );

      expect(labels).toStrictEqual(expect.arrayContaining(days.categories));
      expect(labels).toStrictEqual(expect.arrayContaining(["0", "2", "4", "6", "8"]));
    });
  });

  it("starts a chart's axis where a screen about a cropped axis says", async () => {
    const cropped: LessonVisual = {
      ...LETTERS_CHART,
      axisStart: 30,
      title: "Ofícios respondidos, com o eixo a partir de 30",
    };

    renderLessonPlayer({ lesson: buildLesson([check({ visual: cropped })]) });

    const chart = page.getByRole("figure", { name: cropped.title });
    await expect.element(chart).toBeVisible();
    const ticks = [...chart.element().querySelectorAll("svg text")].map((text) => text.textContent);

    expect(ticks).toContain("30");
    expect(ticks).not.toContain("0");
  });

  it("lists a timeline's events in order with their dates", async () => {
    const lesson = buildLesson([check({ visual: LAW_TIMELINE })]);
    renderLessonPlayer({ lesson });

    const timeline = page.getByRole("figure", { name: "Leis que organizam o serviço público" });
    await expectCount(timeline.getByRole("listitem"), 2);
    await expect.element(timeline.getByText("1988")).toBeVisible();
    await expect.element(timeline.getByText("Lei nº 8.112, dos servidores federais")).toBeVisible();
    await expectAccessibleScreen("a question with a timeline");
  });

  it("waits on a question's picture while it's drawn, then shows it and takes answers", async () => {
    const request = { alt: "Otávio stands next to a blue bike", prompt: "Otávio next to a bike" };
    const base = check({ image: request, question: "Which caption fits the picture?" });
    const step = { ...base, image: null, imagePending: true };
    const lesson = buildLesson([step]);
    const drawn = inlineImage({ alt: request.alt });

    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ image: drawn, stepId: step.id }]);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

    await expect.element(page.getByRole("status")).toHaveTextContent("Drawing the picture…");
    await expect.element(page.getByText(request.alt)).not.toBeInTheDocument();

    // Nobody answers about a picture they can't see yet.
    const firstOption = page.getByRole("radio").first();
    await expect.element(firstOption).toBeDisabled();

    // The next ask, a few seconds later, brings the picture.
    await expect
      .element(page.getByRole("img", { name: request.alt }), { timeout: 8000 })
      .toBeVisible();

    await expect.element(firstOption).toBeEnabled();

    expect(getLessonPictures).toHaveBeenCalledTimes(2);
  });

  it("describes a question's picture that never came, so the question still reads", async () => {
    const request = { alt: "Otávio stands next to a blue bike", prompt: "Otávio next to a bike" };
    const lesson = buildLesson([check({ image: request })]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByText(request.alt)).toBeVisible();
    await expect.element(page.getByText("Drawing the picture…")).not.toBeInTheDocument();
  });
});
