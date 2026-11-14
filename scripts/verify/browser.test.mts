import assert from "node:assert/strict";
import { type Page } from "@playwright/test";
import { test } from "vitest";
import { type TargetSample } from "../../packages/testing/src/accessibility/target-size.ts";
import { checkSchemes } from "./browser.mts";

test("names the tap-target rule separately from axe and includes its required and measured size", async () => {
  const target: TargetSample = {
    blockFontSize: "16px",
    blockLineHeight: "24px",
    blockTextLength: 3,
    clipPath: "none",
    display: "block",
    firstLineHeight: 38,
    height: 38,
    inactive: false,
    name: "Day",
    overflow: "hidden",
    ownTextLength: 3,
    pointerEvents: "auto",
    pseudos: [],
    role: "button",
    slot: undefined,
    userSelect: "auto",
    visibility: "visible",
    width: 90,
  };

  const adapter = {
    emulateMedia: () => Promise.resolve(),
    evaluate: async (reader: string | (() => unknown)) => {
      if (typeof reader !== "string") {
        return reader.name === "sampleTargets" ? [target, { ...target, height: 44 }] : 0;
      }

      if (reader.includes("Boolean(globalThis.axe)")) {
        return true;
      }

      return reader.includes("runOnly")
        ? []
        : [
            {
              help: "Buttons must have discernible text",
              helpUrl: "https://dequeuniversity.com/rules/axe/button-name",
              id: "button-name",
              impact: "serious",
              nodes: [],
            },
          ];
    },
    locator: () => ({ count: () => Promise.resolve(0) }),
    screenshot: () => Promise.resolve(),
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The adapter supplies measured targets and axe results at the browser boundary.
  const page = adapter as unknown as Page;
  const { accessibility } = await checkSchemes(page, { name: "page", schemes: ["light"] });
  assert.equal(accessibility.length, 2);
  assert.ok(accessibility.some((finding) => finding.startsWith("axe: [serious] button-name:")));

  assert.ok(accessibility.includes('Zoonk tap target (44 px): <button> "Day" is 90×38 px'));
});
