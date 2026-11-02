import { type LessonVisual } from "@zoonk/core/library/steps/contract";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { expectCount } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { inlineImage, lawTimeline, lettersChart, teachingStep } from "../preview/preview-steps";

const PHONE = { height: 812, width: 375 };

const PICTURE_POLL_MS = 4000;

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

  it("shows a table written after a guess's question as a table, above the question", async () => {
    const hook = teachingStep("hook");

    if (hook.content.variant !== "guess") {
      throw new Error("The shared hook fixture is a guess.");
    }

    const question = "Renan mede uma peça de 50,0 mm. Qual sensor agrupa leituras perto dela?";

    const lesson = buildLesson([
      {
        ...hook,
        content: {
          ...hook.content,
          question: `${question}\n\n| Sensor | mm |\n|---|---:|\n| A | 49,8; 49,9 |\n| B | 51,0; 51,1 |`,
        },
      },
    ]);

    renderLessonPlayer({ lesson });

    const table = page.getByRole("table");
    await expect.element(table.getByRole("columnheader", { name: "Sensor" })).toBeVisible();
    await expect.element(table.getByRole("cell", { exact: true, name: "B" })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: question })).toBeVisible();
    await expect.element(page.getByText("|---", { exact: false })).not.toBeInTheDocument();
  });

  it("shows a table written in a worked example's step as a table", async () => {
    const worked = teachingStep("workedExample");

    const lesson = buildLesson([
      {
        ...worked,
        content: {
          ...worked.content,
          result: "The sum is _(8, 8) N_: right and up.",
          steps: [
            { text: "Add the horizontal parts, then the vertical ones." },
            {
              text: "Put each force on its axis:\n\n| Force | x (N) | y (N) |\n|---|---:|---:|\n| A | 12 | 5 |\n| B | -4 | 3 |",
            },
          ],
        },
      },
    ]);

    renderLessonPlayer({ lesson });

    await page.getByRole("button", { name: "Show the next step" }).click();

    const table = page.getByRole("table");
    await expect.element(table.getByRole("columnheader", { name: "x (N)" })).toBeVisible();
    await expect.element(table.getByRole("cell", { exact: true, name: "12" })).toBeVisible();
    await expect.element(page.getByText("Put each force on its axis:")).toBeVisible();
    await expect.element(page.getByText("|---", { exact: false })).not.toBeInTheDocument();

    const emphasis = page.getByText("(8, 8) N", { exact: true });
    await expect.element(emphasis).toBeVisible();
    expect(emphasis.element().tagName).toBe("EM");
  });

  it("draws a chart from its data, with every value for screen readers", async () => {
    const explanation = teachingStep("explanation");

    const lesson = buildLesson([
      { ...explanation, content: { ...explanation.content, visual: lettersChart } },
    ]);

    await atViewport(PHONE, async () => {
      renderLessonPlayer({ lesson });

      const chart = page.getByRole("figure", { name: "Ofícios respondidos por mês" });
      await expect.element(chart).toBeVisible();
      await expect.element(chart.getByRole("rowheader", { name: "Junho" })).toBeInTheDocument();
      await expect.element(chart.getByRole("cell", { name: "36" })).toBeInTheDocument();

      expect(chart.element().querySelectorAll("rect")).toHaveLength(3);
      await expectAccessibleScreen("an explanation with a chart");
    });
  });

  it("labels every day of a line chart on a phone, breaking long names over two lines", async () => {
    const days: LessonVisual = {
      ...lettersChart,
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
      ...lettersChart,
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
    const lesson = buildLesson([check({ visual: lawTimeline })]);
    renderLessonPlayer({ lesson });

    const timeline = page.getByRole("figure", { name: "Leis que organizam o serviço público" });
    await expectCount(timeline.getByRole("listitem"), 2);
    await expect.element(timeline.getByText("1988")).toBeVisible();
    await expect.element(timeline.getByText("Lei nº 8.112, dos servidores federais")).toBeVisible();
    await expectAccessibleScreen("a question with a timeline");
  });

  it("takes a first guess while its optional picture is still pending", async () => {
    const hook = teachingStep("hook");

    const lesson = buildLesson([
      {
        ...hook,
        content: {
          ...hook.content,
          image: { alt: "An electron cloud", prompt: "An electron cloud" },
        },
        image: null,
        imagePending: true,
      },
    ]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByText("Drawing the picture…")).toBeVisible();
    await page.getByRole("radio").first().click();
    await expect.element(page.getByRole("button", { name: "See the answer" })).toBeEnabled();
    await page.getByRole("button", { name: "See the answer" }).click();
    await expect.element(page.getByRole("button", { exact: true, name: "Continue" })).toBeVisible();
  });

  it("takes answers while a question's picture is drawn, then shows it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const request = { alt: "Otávio stands next to a blue bike", prompt: "Otávio next to a bike" };
    const base = check({ image: request, question: "Which caption fits the picture?" });
    const step = { ...base, image: null, imagePending: true };
    const lesson = buildLesson([step]);
    const drawn = inlineImage({ alt: request.alt });

    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValue([]);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

    await expect.element(page.getByRole("status")).toHaveTextContent("Drawing the picture…");
    await expect.element(page.getByText(request.alt)).toBeVisible();

    const firstOption = page.getByRole("radio").first();
    await expect.element(firstOption).toBeEnabled();
    await firstOption.click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");

    getLessonPictures.mockResolvedValue([{ image: drawn, stepId: step.id }]);
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);

    await expect.element(page.getByRole("img", { name: request.alt })).toBeVisible();
    await expect.element(page.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  });

  it("describes a question's picture that never came, so the question still reads", async () => {
    const request = { alt: "Otávio stands next to a blue bike", prompt: "Otávio next to a bike" };
    const lesson = buildLesson([check({ image: request })]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByText(request.alt)).toBeVisible();
    await expect.element(page.getByText("Drawing the picture…")).not.toBeInTheDocument();
  });
});
