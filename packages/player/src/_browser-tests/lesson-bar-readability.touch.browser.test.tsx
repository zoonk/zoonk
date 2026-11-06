import { act } from "@testing-library/react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { buildAdapters, renderLessonPlayer, startedRun } from "../_test-utils/render-lesson-player";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const LONG_NAME_BUDDY = {
  beltColor: "white",
  energy: null,
  glasses: "round",
  kind: "zu",
  name: "ProfessorBartholomew",
} as const;

async function atLargeTextOnSmallPhone() {
  const fontSize = document.documentElement.style.fontSize;

  await page.viewport(320, 700);
  document.documentElement.style.fontSize = "200%";

  onTestFinished(() => {
    document.documentElement.style.fontSize = fontSize;
  });
}

function visibleText(button: HTMLElement) {
  const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const hidden = node.parentElement?.closest(".sr-only, [data-slot='shortcut-kbd']");

    if (node instanceof Text && node.data.trim() && !hidden) {
      texts.push(node);
    }
  }

  return texts;
}

function cutOffLabels() {
  const bar = document.querySelector(
    "[data-slot='lesson-action-bar'], [data-slot='task-action-bar']",
  );

  const buttons = [...(bar?.querySelectorAll<HTMLElement>("a, button") ?? [])];
  const cutOff: string[] = [];

  for (const button of buttons.filter((item) => item.getClientRects().length > 0)) {
    const box = button.getBoundingClientRect();
    const name = button.getAttribute("aria-label") ?? button.textContent;

    if (box.left < 0 || box.right > window.innerWidth) {
      cutOff.push(`${name} is off screen`);
    }

    for (const text of visibleText(button)) {
      const range = document.createRange();
      range.selectNodeContents(text);
      const label = range.getBoundingClientRect();

      if (label.left < box.left || label.right > box.right) {
        cutOff.push(`${name} cuts off "${text.data}"`);
      }
    }
  }

  return cutOff;
}

describe("the lesson's bottom bar at 200% text on a 320 px phone", () => {
  it("keeps Check whole between the back and ask buttons", async () => {
    await atLargeTextOnSmallPhone();
    const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")]);
    stubTutorApi({ lesson });
    renderLessonPlayer({ lesson, tutor: buildTutor() });

    await page.getByRole("button", { name: /^Next/u }).click();
    await page.getByRole("radio", { name: "The electron's size" }).click();
    await expect.element(page.getByRole("button", { name: "Previous screen" })).toBeVisible();

    expect(cutOffLabels()).toStrictEqual([]);
  });

  it("keeps Continue and an ask label with a long name whole after a wrong answer", async () => {
    await atLargeTextOnSmallPhone();
    const lesson = buildLesson([teachingStep("check")]);
    stubTutorApi({ lesson });
    renderLessonPlayer({ lesson, tutor: buildTutor({}, { buddy: LONG_NAME_BUDDY }) });

    await page.getByRole("radio", { name: "The electron's size" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .element(page.getByRole("button", { name: "Ask ProfessorBartholomew" }))
      .toBeVisible();

    expect(cutOffLabels()).toStrictEqual([]);
  });

  it("keeps Check whole while it checks the answer", async () => {
    await atLargeTextOnSmallPhone();
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);
    const pending = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>().mockReturnValue(pending.promise);
    stubTutorApi({ lesson });

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep }),
      lesson,
      tutor: buildTutor(),
    });

    await page.getByRole("textbox").fill("It shows where the electron is likely to be");
    const check = page.getByRole("button", { name: /^Check/u });
    await userEvent.click(check);
    await expect.element(check).toHaveAttribute("aria-busy", "true");

    expect(cutOffLabels()).toStrictEqual([]);

    await act(async () => {
      pending.resolve({ status: "failed" });
      await pending.promise;
    });
  });

  it("keeps both links whole at the lesson's end", async () => {
    await atLargeTextOnSmallPhone();
    const lesson = buildLesson([teachingStep("check")]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { startLesson: async () => startedRun({ replay: false }) }),
      lesson,
      routes: {
        exit: "/chapter",
        exitTo: "chapter",
        nextLesson: "/learn/next",
        signUp: "/login",
        upgrade: "/subscription",
      },
    });

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("link", { name: "Back to chapter" })).toBeVisible();

    expect(cutOffLabels()).toStrictEqual([]);
  });
});
