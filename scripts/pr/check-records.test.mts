import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import CASES from "../verify/alignment-cases.json" with { type: "json" };
import { CLEAN, checkFixture, kinds, sha256 } from "./check-fixture.mts";
import { checkPictures } from "./check.mts";
import { type ManifestItem } from "./media.mts";
import { formatCheck } from "./report.mts";

const fixture = checkFixture();
const { capture, shot } = fixture;

describe("pr:media check, when records and reports disagree or are missing", () => {
  it("fails media it can't read, and says a body with no pictures checked nothing", async () => {
    const repository = fixture.repository;

    const unsupported = await checkPictures({
      manifests: [],
      pictures: [],
      repository,
      unsupported: ["<img src=a.png>"],
    });

    const empty = await checkPictures({ manifests: [], pictures: [], repository });

    assert.deepEqual(kinds(unsupported), ["unsupported"]);

    assert.equal(
      formatCheck(empty, repository),
      "NO PICTURES: the body links none, so nothing was checked",
    );
  });

  it("treats a read with no reader's name as no read", async () => {
    const result = await capture([shot({ file: "a.png", read: { ...CLEAN, by: "  " } })]).check();

    assert.deepEqual(kinds(result), ["unread"]);
  });

  it("holds a picture to an after's bar whenever an after record has its bytes, in either order", async () => {
    const after = shot({ file: "a.png", read: undefined });
    const { folder } = capture([after]);

    const registered: ManifestItem = {
      file: join(folder, "a.png"),
      kind: "shot",
      platform: "web",
      sha256: after.sha256,
      side: "before",
      source: "an old baseline",
    };

    const elsewhere = mkdtempSync(join(fixture.repository, "registered-"));
    writeFileSync(join(elsewhere, "capture.json"), JSON.stringify([registered]));

    const results = await Promise.all(
      [
        [folder, elsewhere],
        [elsewhere, folder],
      ].map(async (manifests) =>
        checkPictures({
          manifests,
          pictures: [join(folder, "a.png")],
          repository: fixture.repository,
        }),
      ),
    );

    assert.deepEqual(
      results.map((result) => kinds(result)),
      [["unread"], ["unread"]],
    );
  });

  it("fails an after picture overwritten with a registered before's bytes as changed", async () => {
    const { folder } = capture([shot({ file: "a.png" })]);
    writeFileSync(join(folder, "a.png"), "an old before");

    const registered: ManifestItem = {
      file: "old.png",
      kind: "shot",
      platform: "web",
      sha256: sha256("an old before"),
      side: "before",
      source: "an old baseline",
    };

    const elsewhere = mkdtempSync(join(fixture.repository, "registered-"));
    writeFileSync(join(elsewhere, "capture.json"), JSON.stringify([registered]));

    const result = await checkPictures({
      manifests: [folder, elsewhere],
      pictures: [join(folder, "a.png")],
      repository: fixture.repository,
    });

    assert.deepEqual(kinds(result), ["changed"]);
  });

  it("holds a before picture with its after's bytes to the after's bar, and passes both once it's met", async () => {
    const before = shot({ file: "same.png", read: undefined, side: "before" });
    const unread = capture([before]);
    const after = capture([shot({ file: "same.png", read: undefined })]);
    const pictures = [join(unread.folder, "same.png"), join(after.folder, "same.png")];
    const manifests = [unread.folder, after.folder];
    const failing = await checkPictures({ manifests, pictures, repository: fixture.repository });

    writeFileSync(join(after.folder, "capture.json"), JSON.stringify([shot({ file: "same.png" })]));
    const passing = await checkPictures({ manifests, pictures, repository: fixture.repository });

    assert.deepEqual(kinds(failing), ["unread", "unread"]);
    assert.deepEqual(passing.problems, []);
  });

  it("says which captures' layout wasn't measured", async () => {
    const missing = await capture([shot({ file: "a.png" })]).check();

    const unevaluated = await capture([shot({ file: "b.png" })], {
      alignment: { captures: [], discovery: [] },
    }).check();

    const measured = await capture([shot({ file: "c.png" })], {
      alignment: { captures: [{}], findings: [], summary: { unresolved: 0 } },
    }).check();

    const found = await capture([shot({ file: "d.png" })], {
      alignment: { findings: [{ level: "fail", message: "wrong edge" }] },
    }).check();

    assert.deepEqual(
      [missing, unevaluated, measured, found].map((result) => result.notMeasured),
      [1, 1, 0, 0],
    );

    assert.match(formatCheck(missing, fixture.repository), /; layout not measured for 1 capture$/u);
  });

  it("says how many reads carried over from the same pixels and how many are new", async () => {
    const carried = { ...CLEAN, carriedFrom: sha256("an earlier capture") };

    const { check, folder } = capture([
      shot({ file: "a.png", read: carried }),
      shot({ file: "b.png" }),
      shot({ file: "c.png", read: undefined }),
    ]);

    const lines = formatCheck(await check(), folder).split("\n");

    assert.ok(
      lines.includes(
        "Reads: 1 carried over from a capture with the same pixels, 1 new, 1 still to read",
      ),
    );
  });

  it("fails what the capture's alignment report leaves unresolved or missing", async () => {
    const message = '"Dec 12" ends 28 px short of the group\'s end edge';

    const alignment = {
      findings: [
        { level: "fail", message },
        { level: "fail", message },
        { exception: "the day bar, granted by the user", level: "fail", message: "40 px tall" },
        { level: "discovery", message: "cut off" },
      ],
      summary: { scenariosMissing: 1, unresolved: 2 },
    };

    const result = await capture([shot({ file: "a.png" })], { alignment }).check();

    assert.deepEqual(kinds(result), ["alignment", "scenarios"]);
    assert.equal(result.problems[0]?.detail, message);
  });

  it("prints one finding per kind with its pictures under it, then one summary line", async () => {
    const { check, folder } = capture([
      shot({ file: "a.png", read: undefined }),
      shot({ file: "b.png", read: undefined }),
    ]);

    writeFileSync(join(folder, "c.png"), "gathered by hand");
    const lines = formatCheck(await check(["a.png", "b.png", "c.png"]), folder).split("\n");

    assert.deepEqual(lines, [
      "Not in any capture manifest: take it with pnpm pr:capture (1)",
      "  c.png",
      "No read recorded: run pnpm pr:media tiles, read, then pnpm pr:media read (2)",
      "  a.png",
      "  b.png",
      "Reads: 0 carried over from a capture with the same pixels, 0 new, 2 still to read",
      "FAIL: 1 not in any capture manifest; 2 with no read, of 3 pictures; layout not measured for 1 capture",
    ]);
  });
});

describe("pr:media check, on a capture's measured layout", () => {
  it("judges a before capture's layout not at all: its faults are what the change fixes", async () => {
    const failing = { findings: [{ level: "fail", message: "wrong edge" }], summary: {} };

    const before = await capture([shot({ file: "a.png", side: "before" })], {
      alignment: failing,
    }).check();

    const unmeasured = await capture([shot({ file: "b.png", side: "before" })]).check();

    assert.deepEqual([...kinds(before), ...kinds(unmeasured)], []);
    assert.deepEqual([before.notMeasured, unmeasured.notMeasured], [0, 0]);
  });

  it("tells a screen measured with nothing declared on it from one not measured", async () => {
    const result = await capture([shot({ file: "a.png" }), shot({ file: "b.png" })], {
      alignment: { captures: [{ elements: [] }, { elements: [{ id: "row" }] }], findings: [] },
    }).check();

    assert.equal(result.notMeasured, 0);

    assert.match(
      formatCheck(result, fixture.repository),
      /; layout measured with nothing declared on 1 screen$/u,
    );
  });

  it("judges the captures a folder holds itself, as a native capture leaves them unjudged", async () => {
    const failing = CASES["conditions before 0387bba5c6, phone"];
    const passing = CASES["conditions after, phone"];

    const judged = await Promise.all(
      [failing, passing].map(async (screen) =>
        capture([shot({ file: "a.png" })], { alignment: { captures: [screen] } }).check(),
      ),
    );

    const refused = await capture([shot({ file: "b.png" })], {
      alignment: { captures: [{ ...passing, unit: "pt" }] },
    }).check();

    assert.deepEqual(
      judged.map((result) => kinds(result)),
      [["alignment"], []],
    );

    const filled = await capture([shot({ file: "c.png" })], {
      alignment: { captures: [CASES["plan current row fill 98ae571b1b, phone"]] },
    }).check();

    assert.deepEqual(kinds(refused), ["alignment"]);
    assert.match(filled.problems[0]?.detail ?? "", /passes the page's column/u);
    assert.match(refused.problems[0]?.detail ?? "", /isn't a capture the evaluator reads/u);
  });
});
