import assert from "node:assert/strict";
import { basename } from "node:path";
import { describe, it } from "vitest";
import { CLEAN, checkFixture, kinds } from "./check-fixture.mts";
import { closedSection, resolveFinding } from "./findings.mts";
import { type Finding, readManifest, readOf } from "./media.mts";
import { formatCheck } from "./report.mts";

const polish: Finding = {
  before: false,
  id: "polish-1",
  misleads: false,
  rule: "none",
  state: "open",
  text: "The helper could sit closer to its field",
};

const onBase: Finding = {
  before: true,
  id: "base-1",
  misleads: false,
  rule: "E3",
  state: "open",
  text: "The chevrons end 4 px apart",
};

const broken: Finding = { ...onBase, before: false, id: "broken-1" };

const misleading: Finding = {
  ...onBase,
  id: "misleads-1",
  misleads: true,
  text: "The date reads Nov 16 for a lesson on Nov 17",
};

/** A finding read before the reader sorted its findings. */
const unsorted: Finding = { id: "old-1", state: "open", text: "The gap above the list is 20 px" };

function readWith(findings: Finding[]) {
  const fixture = checkFixture();

  const { check, folder } = fixture.capture([
    fixture.shot({ file: "a.png", read: { ...CLEAN, findings } }),
    fixture.shot({ file: "b.png", read: { ...CLEAN, findings: findings.slice(0, 1) } }),
  ]);

  const findingsNow = async () => {
    const items = (await readManifest(folder)) ?? [];
    return items.flatMap((item) => readOf(item)?.findings ?? []);
  };

  return { check, findingsNow, root: fixture.repository };
}

describe("closing a finding", () => {
  it("files polish and a fault already on the base in an issue, and the check passes them", async () => {
    const { check, findingsNow, root } = readWith([polish, onBase, unsorted]);

    for (const id of [polish.id, onBase.id, unsorted.id]) {
      // oxlint-disable-next-line no-await-in-loop -- Each close rewrites the same manifest.
      await resolveFinding({ id, root, state: { issue: 2790, state: "issue" } });
    }

    const result = await check();

    assert.deepEqual(kinds(result), []);
    assert.match(formatCheck(result, root), /^Findings: 3 filed in an issue;/mu);
    const closed = await findingsNow();
    assert.ok(closed.every((finding) => finding.state === "issue"));
  });

  it("refuses an issue for what misleads a learner or a rule the PR broke", async () => {
    const { findingsNow, root } = readWith([misleading, broken]);
    const state = { issue: 2790, state: "issue" } as const;

    await assert.rejects(resolveFinding({ id: misleading.id, root, state }), /must fix/u);
    await assert.rejects(resolveFinding({ id: broken.id, root, state }), /rule E3/u);
    const open = await findingsNow();
    assert.ok(open.every((finding) => finding.state === "open"));
  });

  it("closes any finding as not a fault with the reason, the check passing it", async () => {
    const { check, root } = readWith([misleading]);
    const reason = "The seed's lesson is dated Nov 16; the screen shows it right";

    await resolveFinding({ id: misleading.id, root, state: { reason, state: "not-a-fault" } });

    assert.deepEqual(kinds(await check()), []);
  });

  it("closes a finding on the read a retake kept, before the retake is read", async () => {
    const fixture = checkFixture();
    const retakes = { file: "earlier/a.png", read: { ...CLEAN, findings: [broken] } };
    const { folder } = fixture.capture([fixture.shot({ file: "a.png", read: undefined, retakes })]);
    const state = { commit: fixture.current, state: "fixed" } as const;

    await resolveFinding({ id: broken.id, root: fixture.repository, state });
    const [item] = (await readManifest(folder)) ?? [];

    assert.deepEqual(
      item && "retakes" in item && item.retakes?.read.findings.map((finding) => finding.state),
      ["fixed"],
    );
  });

  it("names a finding it can't find", async () => {
    const { root } = readWith([polish]);

    await assert.rejects(
      resolveFinding({ id: "nowhere", root, state: { issue: 1, state: "issue" } }),
      /No finding nowhere/u,
    );
  });
});

describe("the PR's list of findings closed without a fix", () => {
  it("lists each once with its pictures and how it closed, and leaves out the fixed and the open", async () => {
    const fixture = checkFixture();

    const findings: Finding[] = [
      { ...polish, issue: 2790, state: "issue" },
      {
        ...onBase,
        reason: "Craft's deliberate choice: a hovered row | passes",
        state: "not-a-fault",
      },
      { ...broken, grantedBy: "the user", state: "exception" },
      { ...misleading, commit: fixture.current, state: "fixed" },
      unsorted,
    ];

    const { folder } = fixture.capture([
      fixture.shot({ file: "a.png", read: { ...CLEAN, findings } }),
      fixture.shot({ file: "b.png", read: { ...CLEAN, findings: findings.slice(0, 1) } }),
    ]);

    const where = basename(folder);

    assert.equal(
      await closedSection(fixture.repository),
      [
        "## Findings closed without a fix",
        "",
        "| Finding | Pictures | Closed |",
        "| --- | --- | --- |",
        `| The helper could sit closer to its field | \`${where}/a.png\`, \`${where}/b.png\` | Filed in #2790 |`,
        `| The chevrons end 4 px apart | \`${where}/a.png\` | Not a fault: Craft\\'s deliberate choice\\: a hovered row \\| passes |`,
        `| The chevrons end 4 px apart | \`${where}/a.png\` | Exception granted by the user |`,
      ].join("\n"),
    );
  });

  it("says when nothing closed without a fix", async () => {
    const fixture = checkFixture();
    fixture.capture([fixture.shot({ file: "a.png" })]);

    assert.equal(await closedSection(fixture.repository), "No finding closed without a fix.");
  });
});
