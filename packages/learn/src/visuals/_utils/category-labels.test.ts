import { describe, expect, it } from "vitest";
import {
  clampLabelCenter,
  fitsUnderBars,
  getCategoryLabels,
  getLabelWidth,
} from "./category-labels";

const DAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira"];

describe(getCategoryLabels, () => {
  it("keeps every label on one line when they fit", () => {
    expect(getCategoryLabels({ band: 120, categories: DAYS })).toStrictEqual({
      lines: DAYS.map((day) => [day]),
      step: 1,
    });
  });

  it("wraps long labels at a hyphen or space when that makes them fit", () => {
    expect(
      getCategoryLabels({ band: 64, categories: ["Segunda-feira", "Pedido pelo app"] }),
    ).toStrictEqual({
      lines: [
        ["Segunda-", "feira"],
        ["Pedido", "pelo app"],
      ],
      step: 1,
    });
  });

  it("keeps every name of any length under its bar, on as many lines as it takes", () => {
    const { lines, step } = getCategoryLabels({
      band: 90,
      categories: ["Responses from the regional customer support team", "Junho", "Julho"],
    });

    expect(step).toBe(1);

    expect(lines).toStrictEqual([
      ["Responses", "from the", "regional", "customer", "support team"],
      ["Junho"],
      ["Julho"],
    ]);
  });

  it("shows every few labels when a word is wider than its bar, wrapped to the room it gets", () => {
    expect(getCategoryLabels({ band: 40, categories: DAYS })).toStrictEqual({
      lines: [["Segunda-", "feira"], ["Terça-feira"], ["Quarta-", "feira"], ["Quinta-", "feira"]],
      step: 2,
    });
  });
});

describe(fitsUnderBars, () => {
  it("keeps bars upright when every name fits its bar in at most two lines", () => {
    expect(
      fitsUnderBars(
        getCategoryLabels({ band: 64, categories: ["Segunda-feira", "Pedido pelo app"] }),
      ),
    ).toBe(true);
  });

  it("lays bars sideways when a name would need a third line", () => {
    expect(
      fitsUnderBars(
        getCategoryLabels({ band: 90, categories: ["Maio, antes da mudança de sistema", "Junho"] }),
      ),
    ).toBe(false);
  });

  it("lays bars sideways when one word is wider than its bar", () => {
    expect(
      fitsUnderBars(
        getCategoryLabels({ band: 54, categories: ["Norte", "Nordeste", "Sudeste", "Sul"] }),
      ),
    ).toBe(false);
  });
});

describe(clampLabelCenter, () => {
  it("leaves a label that fits where it is", () => {
    expect(clampLabelCenter({ lines: ["Junho"], width: 300, x: 150 })).toBe(150);
  });

  it("moves a label in from either edge by its widest line, so it stays inside the chart", () => {
    const lines = ["Segunda-", "feira"];
    const half = getLabelWidth("Segunda-") / 2;

    expect(clampLabelCenter({ lines, width: 300, x: 10 })).toBe(half);
    expect(clampLabelCenter({ lines, width: 300, x: 295 })).toBe(300 - half);
  });
});
