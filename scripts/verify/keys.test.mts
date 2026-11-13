import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import {
  type KeyFacts,
  type PanelFacts,
  keyFindings,
  panelFindings,
  readShortcuts,
} from "./keys.mts";

const QUIET: KeyFacts = {
  enter: { bound: [], pressed: null, unbuilt: [] },
  escape: { pressed: null, task: false, taskClose: false },
  groups: [],
  keycaps: [],
  sidebar: [],
  sidebarsWithoutToggle: [],
};

const START = {
  drawn: true,
  enter: "bound",
  id: "start",
  keycap: true,
  label: "Start",
  taskClose: false,
};

function messages(facts: Partial<KeyFacts>) {
  return keyFindings({ ...QUIET, ...facts }).map(
    (finding) => `${finding.level} ${finding.check}: ${finding.message}`,
  );
}

describe("the screen's keys (IX's A1, A2, A3, A5, A6)", () => {
  it("distinguishes controls with the same label", () => {
    const findings = messages({
      enter: { bound: [{ id: "expected", label: "Start" }], pressed: START, unbuilt: [] },
      keycaps: [
        {
          announced: "Enter",
          expected: "Enter",
          id: "expected",
          label: "Start",
          name: "main",
          pressed: START,
        },
      ],
    });

    assert.equal(findings.length, 2);
    assert.match(findings[0] ?? "", /Enter didn't press Start/u);
    assert.match(findings[1] ?? "", /main key didn't press Start/u);
  });

  it("says nothing for a page whose keys press what they show", () => {
    assert.deepEqual(
      messages({
        enter: { bound: [{ id: "start", label: "Start" }], pressed: START, unbuilt: [] },
        escape: {
          pressed: { ...START, enter: null, keycap: false, label: "Close", taskClose: true },
          task: true,
          taskClose: true,
        },
        groups: [{ label: "Answers", moved: true, tabStops: 1 }],
        keycaps: [
          {
            announced: "F",
            expected: "F",
            id: "start",
            label: "Flag",
            name: "flag",
            pressed: { ...START, label: "Flag" },
          },
        ],
        sidebar: [{ answered: true, restored: true, side: "start" }],
      }),
      [],
    );
  });

  it("fails a sidebar ⌘B can't fold, and Esc pressing what isn't drawn or missing the task's ✕", () => {
    assert.deepEqual(
      messages({
        escape: { pressed: { ...START, drawn: false, label: "Back" }, task: true, taskClose: true },
        sidebar: [{ answered: false, restored: true, side: "start" }],
        sidebarsWithoutToggle: ["end"],
      }),
      [
        "fail Behavior: A1 sidebar key: ⌘B didn't fold the start sidebar",
        "fail Behavior: A1 sidebar key: the end sidebar is drawn with no toggle for it",
        "fail Behavior: A3 Esc: Esc clicked Back, which isn't on screen",
        "fail Behavior: A3 Esc: Esc didn't press the task's ✕",
      ],
    );
  });

  it("leads to Enter pressing the wrong control, missing the main action, or a main action built by hand", () => {
    assert.deepEqual(
      messages({
        enter: {
          bound: [
            { id: "start", label: "Start" },
            { id: "skip", label: "Skip" },
          ],
          pressed: { ...START, enter: null, label: "Skip" },
          unbuilt: ["Continue"],
        },
      }),
      [
        "warn Behavior: A2 Enter: Enter clicked Skip, which isn't a main action showing ⏎",
        "warn Behavior: A2 Enter: two main actions answer Enter: Start, Skip",
        "warn Behavior: A2 Enter: Continue is a main action drawn without the piece that binds Enter",
      ],
    );

    assert.deepEqual(
      messages({ enter: { bound: [{ id: "start", label: "Start" }], pressed: null, unbuilt: [] } }),
      ["warn Behavior: A2 Enter: Enter didn't press Start, the screen's main action"],
    );
  });

  it("leads to a group arrows don't move through and a keycap whose key presses something else", () => {
    assert.deepEqual(
      messages({
        groups: [{ label: "Answers", moved: false, tabStops: 3 }],
        keycaps: [
          {
            announced: null,
            expected: "F",
            id: "flag",
            label: "Flag",
            name: "flag",
            pressed: null,
          },
        ],
      }),
      [
        "warn Behavior: A5 arrows: ↓ didn't move to the next option in Answers",
        "warn Behavior: A5 arrows: Answers has 3 Tab stops, where a group has one",
        "warn Behavior: A6 keycaps: the flag key didn't press Flag, which shows it",
        'warn Behavior: A6 keycaps: Flag announces "" where its key is "F"',
      ],
    );
  });
});

describe("a panel the walk opened (IX's A4 and the founder's rule 5)", () => {
  const panel: PanelFacts = {
    centered: null,
    closeDrawn: true,
    focusBack: true,
    focusInside: true,
    label: "Rename",
    needsClose: true,
    sheet: true,
  };

  it("says nothing for a sheet that takes focus, has a ✕ and gives focus back", () => {
    assert.deepEqual(panelFindings(panel), []);
  });

  it("names each way a panel fails, and a phone's panel that isn't a sheet", () => {
    assert.deepEqual(
      panelFindings({
        ...panel,
        centered: false,
        closeDrawn: false,
        focusBack: false,
        focusInside: false,
        sheet: false,
      }).map((finding) => `${finding.level} ${finding.message}`),
      [
        "fail Rename opened without taking focus",
        "fail Rename has no ✕ and no button to leave by",
        "fail Rename isn't centered on a laptop, or shows its handle",
        "fail Rename didn't close on Esc and give focus back to what opened it",
        "warn Rename opens away from the bottom on a phone, where what opens over a page is a sheet",
      ],
    );
  });
});

describe("reading the measured checkout's keys", () => {
  it("presses what its shortcuts file says, and asserts nothing without one", async () => {
    const checkout = mkdtempSync(join(tmpdir(), "zoonk-keys-"));

    try {
      assert.equal(await readShortcuts(checkout), null);

      mkdirSync(join(checkout, "packages/ui/src/lib"), { recursive: true });

      writeFileSync(
        join(checkout, "packages/ui/src/lib/shortcuts.ts"),
        [
          'export const SHORTCUTS = { main: { keys: ["Enter"] }, sidebar: { keys: ["b"], mod: true } };',
          "export function isModShortcut(name: string) { return name === 'sidebar'; }",
          "export function shortcutKeys(name: string) { return name === 'sidebar' ? 'Meta+B Control+B' : 'Enter'; }",
        ].join("\n"),
      );

      const shortcuts = await readShortcuts(checkout);
      assert.deepEqual(shortcuts?.keys("sidebar"), ["b"]);
      assert.equal(shortcuts?.isModShortcut("sidebar"), true);
      assert.equal(shortcuts?.shortcutKeys("sidebar"), "Meta+B Control+B");
      assert.deepEqual(shortcuts?.keys("missing"), []);
    } finally {
      rmSync(checkout, { force: true, recursive: true });
    }
  });
});
