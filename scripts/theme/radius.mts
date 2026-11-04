import { parseCss, tokensAt } from "./palette.mts";

const ROOT_FONT_SIZE_PX = 16;
const LENGTH = /^(?<value>[\d.]+)(?<unit>px|rem)$/u;
const OFFSET = /^calc\(var\(--radius\)\s*(?<operator>[+-])\s*(?<amount>[\d.]+(?:px|rem))\)$/u;

const RADIUS_TOKENS = [
  ["sm", "sm"],
  ["md", "md"],
  ["lg", "lg"],
  ["option", "option"],
  ["xl", "xl"],
  ["xxl", "2xl"],
] as const;

function pixels(length: string): number {
  const parts = LENGTH.exec(length)?.groups;

  if (!parts?.value || !parts.unit) {
    throw new Error(`Unsupported radius length ${length}`);
  }

  return Number(parts.value) * (parts.unit === "rem" ? ROOT_FONT_SIZE_PX : 1);
}

function radiusValue({ base, value }: { base: number; value: string }): number {
  if (value === "var(--radius)") {
    return base;
  }

  const offset = OFFSET.exec(value)?.groups;

  if (!offset?.operator || !offset.amount) {
    throw new Error(`Unsupported radius value ${value}`);
  }

  return base + (offset.operator === "+" ? 1 : -1) * pixels(offset.amount);
}

export function readRadii(globalsCss: string): Map<string, number> {
  const root = parseCss(globalsCss);
  const base = pixels(tokensAt(root, [":root"]).get("radius") ?? "");
  const theme = tokensAt(root, ["@theme inline"]);

  return new Map(
    RADIUS_TOKENS.map(([name, token]) => [
      name,
      radiusValue({ base, value: theme.get(`radius-${token}`) ?? "" }),
    ]),
  );
}
