import { describe, expect, it } from "vitest";
import { getCategoryLabels } from "./category-labels";

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
