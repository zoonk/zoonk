import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Readable, readableChanges, readableSection } from "./readable.mts";

function screen(texts: (string | [string, string])[], controls: string[] = []): Readable {
  return {
    controls,
    texts: texts.map((text) =>
      typeof text === "string" ? { context: "", text } : { context: text[1], text: text[0] },
    ),
  };
}

describe("what the base showed and the branch doesn't", () => {
  it("lists a lost score first, with the line it was in, then a lost control, then text", () => {
    const base = screen(
      ["Your mocks", ["70%", "Last mock 70% Score in mock 1"], "Keep going", "Start a mock"],
      ["Start a mock", "Review mistakes"],
    );

    const branch = screen(["Your mocks", "Start a mock"], ["Start a mock"]);
    const { gained, lost } = readableChanges(base, branch);

    assert.deepEqual(gained, []);

    assert.deepEqual(lost, [
      { context: "Last mock 70% Score in mock 1", kind: "figure", text: "70%" },
      { context: "", kind: "control", text: "Review mistakes" },
      { context: "", kind: "text", text: "Keep going" },
    ]);
  });

  it("counts repeats, so one of two equal numbers going missing is still a lead", () => {
    const { lost } = readableChanges(screen(["70%", "70%"]), screen(["70%"]));

    assert.deepEqual(
      lost.map((item) => item.text),
      ["70%"],
    );
  });

  it("doesn't list a number still shown in reworded text, only the rewording", () => {
    const { gained, lost } = readableChanges(screen(["45 perguntas"]), screen(["45 questões"]));

    assert.deepEqual(lost, [{ context: "", kind: "text", text: "45 perguntas" }]);
    assert.deepEqual(gained, [{ context: "", kind: "text", text: "45 questões" }]);
  });

  it("lists what the branch added too", () => {
    const { gained } = readableChanges(screen([]), screen(["3 lessons left"]));

    assert.deepEqual(gained, [
      { context: "3 lessons left", kind: "figure", text: "3" },
      { context: "", kind: "text", text: "3 lessons left" },
    ]);
  });
});

/** The section's title, its note and their blank lines. */
const INTRO_LINES = 4;

describe("the report's section", () => {
  const base = [
    { path: "/exam", readable: screen([["70%", "Last mock 70%"]]), viewport: "phone" },
    { path: "/exam", readable: screen([["70%", "Last mock 70%"]]), viewport: "laptop" },
  ];

  it("names each lost figure once, with every screen it was lost on", () => {
    const branch = base.map((load) => ({ ...load, readable: screen([]) }));

    assert.deepEqual(readableSection(base, branch).slice(INTRO_LINES), [
      "- **/exam**",
      "  - On the base, not on the branch:",
      '    - number "70%" (in "Last mock 70%") — phone, laptop',
      "",
    ]);
  });

  it("asks for a new baseline when the old run didn't record what screens say", () => {
    const advice = readableSection(
      base.map(({ path, viewport }) => ({ path, viewport })),
      base,
    ).find((line) => line.includes("didn't record"));

    assert.match(advice ?? "", /didn't record what each screen says/u);
  });
});
