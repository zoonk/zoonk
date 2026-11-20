import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
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

const fence = (language: string, lines: readonly string[]) =>
  `\`\`\`${language}\n${lines.join("\n")}\n\`\`\``;

function codeLines(block: Element): string[] {
  return [...block.querySelectorAll("[data-slot='code-line'] > div")].map(
    (line) => line.textContent ?? "",
  );
}

function noSidewaysScroll() {
  return document.documentElement.scrollWidth <= window.innerWidth;
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

      const right = page.getByRole("radio", { name: /print\(1\)\s*print\(2\)/u });
      await expect.element(right).toBeVisible();
      expect(right.element().querySelector("[data-slot='code-snippet']")).not.toBeNull();

      await right.click();
      await page.getByRole("button", { name: /^Check/u }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
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
