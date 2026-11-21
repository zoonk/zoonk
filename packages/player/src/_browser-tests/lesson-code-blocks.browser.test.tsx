/// <reference types="@vitest/browser-playwright" />

import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep } from "../preview/preview-steps";

const PROGRAM = [
  "for i in range(3):",
  "    if i > 0:",
  '        print(i, "is more than zero, so the loop prints it on its own line")',
  'print("done")',
];

const LONG_LINE = [
  'const resumo = frutas.map((fruta, posicao) => String(posicao + 1) + ". " + fruta).join(", ");',
  "console.log(resumo);",
];

const fence = (language: string, lines: readonly string[]) =>
  `\`\`\`${language}\n${lines.join("\n")}\n\`\`\``;

function codeLines(block: Element): string[] {
  return [...block.querySelectorAll("[data-slot='code-line'] > div")].map(
    (line) => line.textContent ?? "",
  );
}

function pixels(value: string): number {
  return Number(value.replace("px", ""));
}

function noSidewaysScroll() {
  return document.documentElement.scrollWidth <= window.innerWidth;
}

function aside() {
  return page.getByRole("complementary", { name: "Help with this screen" });
}

type FrameTree = { childFrames?: FrameTree[]; frame: { id: string } };

function frameIds({ childFrames = [], frame }: FrameTree): string[] {
  return [frame.id, ...childFrames.flatMap((child) => frameIds(child))];
}

/**
 * What Chrome itself names each node of `role`, as a screen reader hears it. Locators compute names
 * their own way, which reads a `<wbr>` differently.
 */
async function chromeNames(role: string): Promise<string[]> {
  const session = cdp();
  const { frameTree } = await session.send("Page.getFrameTree");

  const trees = await Promise.all(
    frameIds(frameTree).map((frameId) => session.send("Accessibility.getFullAXTree", { frameId })),
  );

  return trees
    .flatMap(({ nodes }) => nodes)
    .filter((node) => !node.ignored && node.role?.value === role)
    .map((node) => String(node.name?.value ?? ""));
}

async function expectTagOnLastLineAtEnd(name: string) {
  const option = page.getByRole("radio", { name });
  await expect.element(option).toBeVisible();

  const tagRow = () => {
    const lines = option.element().querySelectorAll("[data-slot='code-snippet-line']");
    const tags = option.element().querySelectorAll("[data-slot='line-marker']");
    const last = [...lines].at(-1)?.getBoundingClientRect();
    const tag = [...tags].at(-1)?.getBoundingClientRect();

    return { height: option.element().getBoundingClientRect().height, last, tag };
  };

  const before = tagRow();

  expect((before.tag?.top ?? 0) + (before.tag?.height ?? 0) / 2).toBeLessThan(
    before.last?.bottom ?? 0,
  );

  await option.click();
  await expect.element(option.getByText("Your answer")).toBeVisible();

  const after = tagRow();
  expect(after.height).toBe(before.height);
  expect(after.tag?.top).toBe(before.tag?.top);

  const words = option.element().querySelector("[data-slot='answer-option-tag']");
  const row = words?.closest("[data-slot='line-marker']")?.parentElement;

  expect(words?.getBoundingClientRect().right).toBeCloseTo(
    row?.getBoundingClientRect().right ?? 0,
    0,
  );
}

describe("code in a lesson", () => {
  it("shows a question's program as written and its code options as code, on a phone", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const lesson = buildLesson([
        contentStep("check", {
          content: {
            basis: null,
            options: [
              {
                id: "a",
                isCorrect: true,
                reason: "The `if` skips 0.",
                text: fence("python", ["print(1)", "print(2)"]),
              },
              {
                id: "b",
                isCorrect: false,
                reason: "`range(3)` starts at 0.",
                text: fence("python", ["print(0)", "print(1)"]),
              },
            ],
            question: `What does this print first?\n${fence("python", PROGRAM)}`,
          },
        }),
      ]);

      renderLessonPlayer({ lesson });

      await expect
        .element(page.getByRole("heading", { name: "What does this print first?" }))
        .toBeVisible();

      const program = page.getByRole("group", { name: "Code" });
      await expect.element(program).toBeVisible();
      expect(codeLines(program.element())).toStrictEqual(PROGRAM);
      expect(document.querySelector("h2 [data-slot='code-lines']")).toBeNull();
      expect(noSidewaysScroll()).toBe(true);

      const right = page.getByRole("radio", { name: "Line 1: print(1) Line 2: print(2)" });
      await expect.element(right).toBeVisible();
      expect(right.element().querySelector("[data-slot='code-snippet']")).not.toBeNull();

      await right.click();
      await page.getByRole("button", { name: /^Check/u }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });
  });

  it("names code by its lines and how far each is indented, and inline code as written", async () => {
    const lesson = buildLesson([
      contentStep("check", {
        content: {
          basis: null,
          options: [
            {
              id: "inside",
              isCorrect: true,
              reason: "The `print` is inside the loop.",
              text: fence("python", ["for fruta in frutas:", "    print(fruta)"]),
            },
            {
              id: "outside",
              isCorrect: false,
              reason: "This `print` runs once, after the loop.",
              text: fence("python", ["for fruta in frutas:", "print(fruta)"]),
            },
            {
              id: "list",
              isCorrect: false,
              reason: "This builds a list.",
              text: "`resultado=list(range(1,6))`",
            },
          ],
          question: `Which one prints every fruit?\n${fence("python", ["frutas = ['maçã']", "", "\tprint(frutas)"])}`,
        },
      }),
    ]);

    renderLessonPlayer({ lesson });
    await expect.element(page.getByRole("radio").first()).toBeVisible();

    const names = await chromeNames("radio");

    expect(names.toSorted()).toStrictEqual([
      "Line 1: for fruta in frutas: Line 2, indented 4 spaces: print(fruta)",
      "Line 1: for fruta in frutas: Line 2: print(fruta)",
      "resultado=list(range(1,6))",
    ]);

    const text = await chromeNames("StaticText");

    expect(text).toStrictEqual(
      expect.arrayContaining([
        "Line 1: frutas = ['maçã']",
        "Line 2: blank",
        "Line 3, indented 1 tab: print(frutas)",
      ]),
    );

    expect(text).not.toContain("frutas = ['maçã']");
  });

  it("wraps code in a narrow panel, and in a wide column scrolls it as a table under numbers that stay put", async () => {
    const lesson = buildLesson([
      explanationStep({ text: `In JavaScript:\n\n${fence("js", LONG_LINE)}`, title: "A map" }),
      contentStep("check", { content: { ...playableStepContent.check, basis: null } }),
    ]);

    renderLessonPlayer({ lesson });

    const frame = page.getByRole("group", { name: "Code" });
    await expect.element(frame).toBeVisible();

    const scroller = frame.element();
    const frameBox = scroller.closest("[data-variant]");
    const number = scroller.querySelector<HTMLElement>("[data-slot='code-line'] > span");
    const start = number?.getBoundingClientRect().left;

    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(frameBox?.querySelector("button")).toBeNull();

    await expect.poll(() => scroller.getAttribute("tabindex")).toBe("0");
    await userEvent.click(scroller);
    await userEvent.keyboard("{End}");

    await expect
      .poll(() => scroller.scrollLeft)
      .toBeGreaterThanOrEqual(scroller.scrollWidth - scroller.clientWidth - 1);

    expect(number?.getBoundingClientRect().left).toBe(start);
    expect(number?.checkVisibility()).toBe(true);

    await userEvent.keyboard("{Home}");
    await expect.poll(() => scroller.scrollLeft).toBe(0);

    await page.getByRole("button", { name: /^Continue/u }).click();

    const panel = aside().getByRole("group", { name: "Code" });
    await expect.element(panel).toBeVisible();
    expect(panel.element().scrollWidth).toBeLessThanOrEqual(panel.element().clientWidth + 1);
    expect(panel.element().getAttribute("tabindex")).toBeNull();
  });

  it("keeps a code option's tag on its last line at the card's end, picked or not", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const lesson = buildLesson([
        contentStep("check", {
          content: {
            basis: null,
            options: [
              { id: "one", isCorrect: true, reason: "It prints both.", text: "```\n8 12\n```" },
              { id: "two", isCorrect: false, reason: "One per line.", text: "```\n8\n12\n```" },
              { id: "wide", isCorrect: false, reason: "No list.", text: fence("js", LONG_LINE) },
            ],
            question: "What does it print?",
          },
        }),
      ]);

      renderLessonPlayer({ lesson });
      await document.fonts.ready;

      await expectTagOnLastLineAtEnd("Line 1: 8 Line 2: 12");
      await expectTagOnLastLineAtEnd(`Line 1: ${LONG_LINE[0]} Line 2: ${LONG_LINE[1]}`);
    });
  });

  it("marks each extra row of a wrapped code option, so it never reads as a line of its own", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const program = [
        "class Exportador extends Servico, Compactador {",
        "  void exportar() { compactar(); }",
        "}",
      ];

      const lesson = buildLesson([
        contentStep("check", {
          content: {
            basis: null,
            options: [
              {
                id: "a",
                isCorrect: true,
                reason: "It extends both.",
                text: fence("java", program),
              },
              { id: "b", isCorrect: false, reason: "It extends one.", text: "```\nok\n```" },
            ],
            question: "Which version does it?",
          },
        }),
      ]);

      renderLessonPlayer({ lesson });
      await document.fonts.ready;

      const option = page.getByRole("radio", { name: /class Exportador/u });
      await expect.element(option).toBeVisible();

      const lines = [
        ...option.element().querySelectorAll<HTMLElement>("[data-slot='code-snippet-line']"),
      ];

      const rows = lines.map((line) => {
        const box = line.getBoundingClientRect();
        const style = getComputedStyle(line);
        const height = pixels(style.lineHeight);
        const marks = line.querySelector("[data-slot='code-wrap-marks']")?.getBoundingClientRect();

        return {
          markEnd: marks?.right ?? 0,
          markTop: (marks?.top ?? 0) - box.top,
          marked: Math.round((marks?.height ?? 0) / height),
          rest: box.left + pixels(style.paddingInlineStart),
          rowHeight: height,
          rows: Math.round(box.height / height),
        };
      });

      expect(rows[0]?.rows).toBeGreaterThan(1);

      for (const row of rows) {
        expect(row.marked).toBe(row.rows - 1);
      }

      const [wrapped] = rows;
      expect(wrapped?.markTop).toBeCloseTo(wrapped?.rowHeight ?? 0, 0);
      expect(wrapped?.markEnd).toBeLessThan(wrapped?.rest ?? 0);
    });
  });

  it("frames a code example and keeps the sentences around it as text", async () => {
    const example = `Run this:\n\n${fence("js", ["const total = 1 + 2;", "console.log(total);"])}\n\nIt prints 3.`;

    const lesson = buildLesson([
      explanationStep(
        { text: `Code runs top to bottom.\n\n${example}`, title: "Order" },
        { marks: { example, icon: null, ideaIndex: null, underline: null } },
      ),
    ]);

    renderLessonPlayer({ lesson });

    const frame = page.getByRole("group", { name: "Code" });
    await expect.element(frame).toBeVisible();

    expect(codeLines(frame.element())).toStrictEqual([
      "const total = 1 + 2;",
      "console.log(total);",
    ]);

    expect(frame.element().closest("[data-slot='example-box']")).not.toBeNull();
    await expect.element(page.getByText("It prints 3.")).toBeVisible();
  });
});
