import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { type SimFinding, formatSimBatch, runSimBatch } from "./_test-utils/sim/sim-batch";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import { SIM_FIXTURES, type SimFixtureName } from "./_test-utils/sim/sim-fixture";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";
import { isOpenFinding } from "./_test-utils/sim/sim-open-findings";

/**
 * The simulator's large tier, on demand: `SIM_RUNS` learners per fixture (`SIM_FIXTURES` picks
 * fixtures, `SIM_SEED` the first seed), each broken rule shrunk to a repro (`SIM_SHRINK=0` skips
 * it) and, with `SIM_CONFIRM=1`, lived again through the real capabilities to confirm it; the
 * report is written to `SIM_REPORT` (else the temp folder's `sim-report.md`). `SIM_TIER=db` lives
 * every learner through the real capabilities instead, with a question bank, for the rules only
 * that tier can check (what screens say, practice, answers); it doesn't shrink. From packages/core:
 * `SIM_RUNS=50 SIM_REPORT=/tmp/sim.md pnpm vitest run src/plans/simulated-learners-large.test.ts`.
 */
const runs = Number(process.env.SIM_RUNS ?? 0);
const firstSeed = Number(process.env.SIM_SEED ?? 1000);

const fixtures = (process.env.SIM_FIXTURES?.split(",") ?? SIM_FIXTURES).filter(
  (name): name is SimFixtureName => SIM_FIXTURES.includes(name as SimFixtureName),
);

const HOURS = 3_600_000;
const throughDb = process.env.SIM_TIER === "db";

// The mistake classifier is a paid model call: a wrong answer whose cause isn't clear is a gap here.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({
  classifyMistakeCause: vi.fn(async () => ({ data: { cause: "gap" } })),
}));

// Vercel Blob is the external store a deleted account's files are removed from.
vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  list: vi.fn(async () => ({ blobs: [], cursor: undefined, hasMore: false })),
}));

/** A life through the real capabilities, with questions to answer, on the learner's own clock. */
async function liveInDb(life: SimLife) {
  vi.useFakeTimers({ toFake: ["Date"] });

  try {
    return await runSimLifeInDb(life, { questions: true });
  } finally {
    vi.useRealTimers();
  }
}

/** A finding's shrunk life through the real capabilities: does the same rule break there too? */
async function confirmInDb(finding: SimFinding) {
  vi.useFakeTimers({ toFake: ["Date"] });

  try {
    const { violations } = await runSimLifeInDb(finding.life, { deleteAccount: false });
    finding.confirmed = violations.some((violation) => violation.rule === finding.rule);
  } finally {
    vi.useRealTimers();
  }
}

describe.runIf(runs > 0)("simulated learners, large tier", () => {
  it(
    "keeps the owner's rules for every learner",
    async () => {
      const batch = await runSimBatch({
        fixtures,
        ...(throughDb && { live: liveInDb }),
        seeds: () => Array.from({ length: runs }, (_, index) => firstSeed + index),
        shrink: !throughDb && process.env.SIM_SHRINK !== "0",
      });

      if (process.env.SIM_CONFIRM === "1" && !throughDb) {
        // One life at a time: each moves the shared clock.
        await batch.findings.reduce(
          (previous, finding) => previous.then(() => confirmInDb(finding)),
          Promise.resolve(),
        );
      }

      const report = process.env.SIM_REPORT ?? join(tmpdir(), "sim-report.md");
      writeFileSync(report, `${formatSimBatch(batch)}\n`);

      const unexpected = batch.findings.filter((finding) => !isOpenFinding(finding));

      expect(unexpected.map((finding) => finding.repro ?? finding.violation.message)).toStrictEqual(
        [],
      );
    },
    12 * HOURS,
  );
});
