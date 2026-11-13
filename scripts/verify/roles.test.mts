import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type RoleCapture, roleSheetHtml } from "./roles.mts";

const SAMPLE: RoleCapture = {
  box: { height: 44, width: 80, x: 0, y: 12 },
  file: "/tmp/link.png",
  gap: 8,
  glyph: "16×16",
  index: 0,
  label: "Settings",
  path: "/one",
  role: "back-link",
  state: "page",
  viewport: "phone",
};

describe("role comparison sheets", () => {
  it("marks values differing from the most common value in this role and viewport", () => {
    const html = roleSheetHtml({
      captures: [
        SAMPLE,
        { ...SAMPLE, path: "/two" },
        { ...SAMPLE, box: { ...SAMPLE.box, height: 48 }, path: "/three" },
        { ...SAMPLE, gap: 16, viewport: "laptop" },
      ],
      paths: ["/one", "/two", "/three"],
      role: "back-link",
      viewport: "phone",
    });

    assert.equal((html.match(/class="diff"/gu) ?? []).length, 1);
    assert.match(html, /class="diff">48/u);
  });

  it("reports missing hooks rather than producing an empty success sheet", () => {
    const html = roleSheetHtml({
      captures: [],
      paths: ["/one"],
      role: "eyebrow",
      viewport: "phone",
    });

    assert.match(html, /\/one/u);
    assert.match(html, /No visible slot in captured states/u);
  });

  it("escapes learner text and paths in a local sheet", () => {
    const path = "/<script>";

    const html = roleSheetHtml({
      captures: [{ ...SAMPLE, label: "<img src=x onerror=alert(1)>", path }],
      paths: [path],
      role: "back-link",
      viewport: "phone",
    });

    assert.match(html, /&lt;script&gt;/u);
    assert.match(html, /&lt;img src=x/u);
    assert.doesNotMatch(html, /<script>/u);
  });
});
