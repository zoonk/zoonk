// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import { OVERLAYS } from "./overlays.mts";
import { installPageHelpers } from "./page-helpers.mts";
import { readRoles } from "./roles-probe.mts";

const TOP = 20;
const HEIGHT = 44;

beforeEach(() => {
  installPageHelpers();

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(10, TOP, 100, HEIGHT),
  );

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test("captures every shared overlay and the gate's real slot, leaving unrelated dialogs out", () => {
  document.body.innerHTML = `${OVERLAYS.map(({ panel }) => `<div data-slot="${panel}">${panel}</div>`).join("")}
    <section data-slot="subscribe-gate">Subscribe</section><div role="dialog">Unknown</div>`;

  const samples = readRoles(OVERLAYS);
  assert.equal(samples.filter(({ role }) => role === "overlay").length, OVERLAYS.length);
  assert.equal(samples.find(({ role }) => role === "subscription-gate")?.label, "Subscribe");
  assert.deepEqual(samples[0]?.box, { height: 44, width: 100, x: 10, y: 20 });
});
