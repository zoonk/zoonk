import assert from "node:assert/strict";
import {
  array,
  assert as assertProperty,
  constantFrom,
  oneof,
  property,
  record,
  string,
} from "fast-check";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { describe, it } from "vitest";
import { checkFixture } from "./check-fixture.mts";
import { deviceSection } from "./device-section.mts";
import { deviceLine } from "./media.mts";

type Node = { children?: Node[]; type: string; value?: string };

/** What a reader sees of a node's words: its text, as GitHub draws it. */
function wordsOf(node: Node): string {
  return node.value ?? (node.children ?? []).map((child) => wordsOf(child)).join("");
}

function fold(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

const PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".split("");

/** Words a device or an author could give: letters, digits, every ASCII punctuation, spaces, line breaks, other scripts. */
const anyText = string({
  maxLength: 24,
  minLength: 1,
  unit: oneof(
    constantFrom(..."aZ09 \n\t".split("")),
    constantFrom(...PUNCTUATION),
    constantFrom("é", "ü", "日本", "🙂", "\u200F"),
  ),
}).filter((text) => fold(text) !== "" && !/@\w/u.test(text));

describe("the section's words, whatever a device or an author gives (RV79)", () => {
  it("keeps every caption whole: a device that reports a | (RV79 P1)", () => {
    const { shot } = checkFixture();

    const item = shot({
      build: {
        app: "android",
        commit: "unknown",
        id: "installed 2099-11-15T10:00:00.000Z, app 1.0",
      },
      device: "Pixel | review phone, Android 16",
      file: "sheet.png",
      shows: "Sheet over plan",
    });

    const root = fromMarkdown(deviceSection([{ item, link: "device/sheet.png" }]), {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    }) as Node;

    const table = root.children?.find((node) => node.type === "table");
    // A table's rows, its header first; the line of dashes is no row of its own.
    assert.equal(wordsOf(table?.children?.[2] ?? { type: "none" }), deviceLine(item));
  });

  it("reads back as one heading, a table per three pictures, and each one's words as given", () => {
    const { shot } = checkFixture();

    assertProperty(
      property(
        array(record({ build: anyText, device: anyText, name: anyText }), {
          maxLength: 7,
          minLength: 1,
        }),
        (inputs) => {
          const shots = inputs.map(({ build, device, name }, index) => ({
            item: shot({
              build: { app: "android", commit: "unknown", id: build },
              device,
              file: `shot-${index}.png`,
              shows: name,
            }),
            link: `device/shot-${index}.png`,
          }));

          const root = fromMarkdown(deviceSection(shots), {
            extensions: [gfm()],
            mdastExtensions: [gfmFromMarkdown()],
          }) as Node;

          const blocks = root.children ?? [];
          const tables = blocks.filter((node) => node.type === "table");

          const cells = (row: number) =>
            tables.flatMap((table) => table.children?.[row]?.children ?? []);

          const images = (node: Node): number =>
            (node.type === "image" ? 1 : 0) +
            (node.children ?? []).reduce((total, child) => total + images(child), 0);

          assert.equal(blocks.filter((node) => node.type === "heading").length, 1);
          assert.equal(tables.length, Math.ceil(inputs.length / 3));
          assert.equal(images(root), inputs.length);

          assert.deepEqual(
            cells(0).map((cell) => fold(wordsOf(cell))),
            inputs.map(({ name }) => fold(name)),
          );

          assert.deepEqual(
            cells(2).map((cell) => fold(wordsOf(cell))),
            shots.map(({ item }) => fold(deviceLine(item))),
          );
        },
      ),
    );
  });
});
