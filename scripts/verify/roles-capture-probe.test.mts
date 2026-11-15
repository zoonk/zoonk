// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import { LIST_GROUP } from "./alignment-table.mts";
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

  const samples = readRoles({ listGroup: LIST_GROUP, overlays: OVERLAYS });
  assert.equal(samples.filter(({ role }) => role === "overlay").length, OVERLAYS.length);
  assert.equal(samples.find(({ role }) => role === "subscription-gate")?.label, "Subscribe");
  assert.deepEqual(samples[0]?.box, { height: 44, width: 100, x: 10, y: 20 });
});

test("measures a list's last three rows by what a list row is, whatever slot a row carries", () => {
  // The first week's rows carry `week-day`, a settings list its `list-row`s inside one `ul`.
  document.body.innerHTML = `<div data-slot="list-group">${["Mon", "Tue", "Wed", "Thu", "Fri"]
    .map((day) => `<div data-slot="week-day">${day}</div>`)
    .join("")}</div>
    <div data-slot="list-group"><ul>${["Name", "Email", "Language", "Theme"]
      .map((row) => `<li><a data-slot="list-row">${row}</a></li>`)
      .join("")}</ul></div>`;

  const tails = readRoles({ listGroup: LIST_GROUP, overlays: OVERLAYS }).filter(
    ({ role }) => role === "list-tail",
  );

  assert.deepEqual(
    tails.map(({ label }) => label),
    ["Wed Thu Fri", "Email Language Theme"],
  );
});
