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

  it("breaks long labels at the hyphen or space nearest their middle when that makes them fit", () => {
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

  it("shows every second or third label when even two lines don't fit", () => {
    expect(getCategoryLabels({ band: 40, categories: DAYS })).toStrictEqual({
      lines: DAYS.map((day) => [day]),
      step: 3,
    });
  });
});
