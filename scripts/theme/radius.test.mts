import { describe, expect, it } from "vitest";
import { readRadii } from "./radius.mts";

const theme = `
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-option: calc(var(--radius) + 2px);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
}
`;

describe(readRadii, () => {
  it.each([
    { base: "0.625rem", expected: { lg: 10, md: 8, option: 12, sm: 6, xl: 14, xxl: 18 } },
    { base: "12px", expected: { lg: 12, md: 10, option: 14, sm: 8, xl: 16, xxl: 20 } },
  ])("resolves the web's named scale from a $base base", ({ base, expected }) => {
    const radii = readRadii(`${theme}\n:root { --radius: ${base}; }`);

    expect(Object.fromEntries(radii)).toStrictEqual(expected);
  });

  it("reads each offset from the CSS instead of fixing a copy of the scale", () => {
    const css = theme.replace(
      "--radius-option: calc(var(--radius) + 2px)",
      "--radius-option: calc(var(--radius) + 3px)",
    );

    const radii = readRadii(`${css}\n:root { --radius: 0.625rem; }`);
    const changed = 13;

    expect(radii.get("option")).toBe(changed);
  });
});
