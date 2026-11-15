/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Capture } from "./alignment-capture.mts";
import { element, fixtureCapture } from "./alignment-fixtures.mts";
import { webCapture } from "./alignment-probe.mts";
import { evaluateCapture } from "./alignment.mts";

/** The landing's goal box submits "Build my plan"; its end and its pinned bar link to /start. */
function buildMyPlanTwice(marketing: boolean): Capture {
  return {
    ...fixtureCapture([
      element({
        group: null,
        id: "a0",
        part: "action",
        piece: "action",
        surface: "page",
        target: "action:build-plan",
        text: "Build my plan ⏎",
        variant: "filled",
      }),
      element({
        group: null,
        id: "a1",
        part: "action",
        piece: "action",
        surface: "page",
        target: "https://zoonk.test/start",
        text: "Build my plan",
        variant: "filled",
      }),
    ]),
    ...(marketing ? { marketing: true } : {}),
  };
}

function oneFilled(capture: Capture) {
  return evaluateCapture(capture).filter((finding) => finding.rule === "one-filled");
}

describe("a marketing page repeats its one action in the same words (design skill, Marketing pages)", () => {
  it("counts the same words once on a marketing page, wherever each one goes and whatever keycap it shows", () => {
    assert.deepEqual(oneFilled(buildMyPlanTwice(true)), []);
  });

  it("still counts them twice on an app screen, where two places are two actions", () => {
    assert.equal(oneFilled(buildMyPlanTwice(false)).length, 1);
  });

  it("still fails two different actions on a marketing page (the blog's Try Zoonk and Build my plan)", () => {
    const capture = buildMyPlanTwice(true);

    const renamed = {
      ...capture,
      elements: capture.elements.map((item) =>
        item.id === "a1" ? { ...item, text: "Try Zoonk" } : item,
      ),
    };

    assert.equal(oneFilled(renamed).length, 1);
  });
});

/** The design site's moments page: a specimen card's "RIGHT 30" box drawn past the page's column. */
function specimenPage(specimen: boolean): Capture {
  return {
    ...fixtureCapture([
      element({
        bounds: [0, 100, 390, 60],
        column: [16, 374],
        frame: [0, 390],
        group: null,
        id: "fill",
        kind: "box",
        name: '"RIGHT 30"',
        part: "fill",
        piece: "page",
      }),
    ]),
    ...(specimen ? { specimen: true } : {}),
  };
}

describe("the design site shows pieces as specimens (EXCEPTIONS: the design site is its own surface)", () => {
  it("doesn't hold a specimen gallery to the page's column", () => {
    assert.deepEqual(
      evaluateCapture(specimenPage(true)).filter((finding) => finding.rule === "column"),
      [],
    );

    assert.equal(
      evaluateCapture(specimenPage(false)).filter((finding) => finding.rule === "column").length,
      1,
    );
  });
});

describe("what a web capture says the page is", () => {
  const page = { activeSurface: "page", elements: [] };

  const kind = (app: string, path: string) => {
    const { marketing, specimen } = webCapture({
      app,
      page,
      path,
      scheme: "light",
      viewport: "phone",
    });

    return { marketing: marketing ?? false, specimen: specimen ?? false };
  };

  it("marks the landing, the catalog, pricing and the blog as marketing, and an app screen not", () => {
    assert.deepEqual(kind("main", "/"), { marketing: true, specimen: false });
    assert.deepEqual(kind("main", "/pt/courses/law"), { marketing: true, specimen: false });
    assert.deepEqual(kind("main", "/pricing"), { marketing: true, specimen: false });
    assert.deepEqual(kind("blog", "/2026/zoonk-2"), { marketing: true, specimen: false });
    assert.deepEqual(kind("main", "/today"), { marketing: false, specimen: false });
    assert.deepEqual(kind("admin", "/"), { marketing: false, specimen: false });
  });

  it("marks the design site's pages as a specimen gallery, and the playground's lesson preview not", () => {
    assert.deepEqual(kind("playground", "/design/moments"), { marketing: false, specimen: true });
    assert.deepEqual(kind("playground", "/design"), { marketing: false, specimen: true });
    assert.deepEqual(kind("playground", "/preview"), { marketing: false, specimen: false });
  });
});
