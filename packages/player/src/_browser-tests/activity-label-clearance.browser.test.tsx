import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";

const base = activityContentFixtures.distributionExplorer;

function labelBox(text: string): DOMRect {
  const node = [...document.querySelectorAll("figure svg text")].find(
    (label) => label.textContent === text,
  );

  expect(node).toBeDefined();
  return node!.getBoundingClientRect();
}

describe("activity label clearance", () => {
  it.each([
    { content: base, name: "normal near its mean", tail: "50%", target: "70 to 130: 95.45%" },
    {
      content: {
        ...base,
        check: { ...base.check, answer: 30 },
        fields: { ...base.fields, distribution: { kind: "uniform", max: 200, min: 0 } as const },
      },
      name: "flat across its top",
      tail: "50%",
      target: "70 to 130: 30%",
    },
  ])("distribution tails clear the checked target: $name", async ({ content, target, tail }) => {
    await atViewport({ height: 844, width: 390 }, async () => {
      openActivity({ content, template: "distributionExplorer" });
      await pressOnSlider("Lower handle", "ArrowRight", 2);
      await checkActivity();
      await expectVerdict("Not quite");
      await expect.element(page.getByText(target, { exact: true })).toBeVisible();

      await expect
        .poll(() => {
          const a = labelBox(target);
          const b = labelBox(tail);
          return Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
        })
        .toBeGreaterThanOrEqual(4);
    });
  });

  it("symbolic balance centers each wrapped line in large text", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    const balance = activityContentFixtures.balance;

    await atViewport({ height: 844, width: 390 }, async () => {
      openActivity({
        content: {
          ...balance,
          check: { ...balance.check, answer: 6 },
          fields: {
            ...balance.fields,
            equation: { left: "4*x + 15", right: "2*x + 27" },
            steps: [
              { left: "400*x + 1500", move: "Multiply both sides by 100", right: "200*x + 2700" },
              { left: "200*x", move: "Take 200x and 1500 off each side", right: "1200" },
              { left: "x", move: "Split each side into 200 equal groups", right: "6" },
            ],
          },
        },
        template: "balance",
      });

      await expect.element(page.getByText("4x + 15 = 2x + 27", { exact: true })).toBeVisible();
      const equation = document.querySelector('[data-slot="balance-symbolic"] > p')!;
      const range = document.createRange();
      range.selectNodeContents(equation);
      const lines = [...range.getClientRects()];
      expect(lines.length).toBeGreaterThan(1);
      const box = equation.getBoundingClientRect();

      for (const line of lines) {
        expect(Math.abs((line.left + line.right - box.left - box.right) / 2)).toBeLessThan(1);
      }
    });
  });
});

function paintedColor(node: Element): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d")!;
  const ancestors: Element[] = [];

  for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
    ancestors.unshift(ancestor);
  }

  for (const ancestor of ancestors) {
    context.fillStyle = getComputedStyle(ancestor).backgroundColor;
    context.fillRect(0, 0, 1, 1);
  }

  const color = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
  const figure = node.closest("figure");

  const opacity = ancestors
    .slice(figure ? ancestors.indexOf(figure) + 1 : ancestors.length)
    .reduce((alpha, ancestor) => alpha * Number(getComputedStyle(ancestor).opacity), 1);

  if (figure && opacity < 1) {
    const ground = paintedColor(figure);

    return color.map((channel, index) =>
      Math.round(channel * opacity + ground[index]! * (1 - opacity)),
    );
  }

  return color;
}

function luminance(rgb: number[]): number {
  return rgb
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function contrast(first: Element, second: Element): number {
  const a = luminance(paintedColor(first));
  const b = luminance(paintedColor(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("activity slider contrast", () => {
  it.each([
    { colorScheme: "light", contrast: "no-preference" },
    { colorScheme: "dark", contrast: "no-preference" },
    { colorScheme: "light", contrast: "more" },
    { colorScheme: "dark", contrast: "more" },
  ] as const)(
    "slider distinguishes its two parts and ground: $colorScheme $contrast",
    async (media) =>
      onDevice(media, async () => {
        document.documentElement.classList.toggle("dark", media.colorScheme === "dark");

        onTestFinished(() => {
          document.documentElement.classList.remove("dark");
        });

        openActivity({ template: "formulaModel" });
        await expect.element(page.getByRole("slider").first()).toBeVisible();
        const track = document.querySelector('[data-slot="slider-track"]')!;
        const fill = track.querySelector('[data-slot="slider-indicator"]')!;
        const ground = track.closest("figure")!;
        expect(contrast(track, ground)).toBeGreaterThanOrEqual(3);
        expect(contrast(fill, track)).toBeGreaterThanOrEqual(3);
        await pressOnSlider("Rate per year", "ArrowRight", 1);
        await checkActivity();
        await expectVerdict("Not quite");
        expect(contrast(track, ground)).toBeGreaterThanOrEqual(3);
        expect(contrast(fill, track)).toBeGreaterThanOrEqual(3);
      }),
  );
});
