import { afterEach, describe, expect, it } from "vitest";
import { readDuration, readEasing } from "./motion";

function elementUnder(styles: Record<string, string>): HTMLElement {
  const parent = document.createElement("div");

  for (const [property, value] of Object.entries(styles)) {
    parent.style.setProperty(property, value);
  }

  const element = document.createElement("span");
  parent.append(element);
  document.body.append(parent);
  return element;
}

function clearPage() {
  document.body.replaceChildren();
}

describe(readDuration, () => {
  afterEach(clearPage);

  it("reads a token in milliseconds, written in milliseconds or seconds, as minified CSS writes it", () => {
    expect(readDuration(elementUnder({ "--transition-duration-fill": "700ms" }), "fill")).toBe(700);

    expect(readDuration(elementUnder({ "--transition-duration-settle": "0.65s" }), "settle")).toBe(
      650,
    );

    expect(readDuration(elementUnder({ "--transition-duration-fill": ".7s" }), "fill")).toBe(700);
  });

  it("is 0 when reduced motion zeroes the token or nothing sets it, so a script shows the end", () => {
    expect(readDuration(elementUnder({ "--transition-duration-fill": "0ms" }), "fill")).toBe(0);
    expect(readDuration(elementUnder({}), "fill")).toBe(0);
    expect(readDuration(elementUnder({ "--transition-duration-fill": "700" }), "fill")).toBe(0);
  });
});

describe(readEasing, () => {
  afterEach(clearPage);

  it("reads the token's curve, or the browser's ease-out without one", () => {
    const curve = "cubic-bezier(0.22, 1, 0.36, 1)";

    expect(readEasing(elementUnder({ "--ease-out": curve }), "out")).toBe(curve);
    expect(readEasing(elementUnder({}), "spring")).toBe("ease-out");
  });
});
