import { describe, expect, it } from "vitest";
import { runSimBatch } from "./_test-utils/sim/sim-batch";
import { type SimFixtureName } from "./_test-utils/sim/sim-fixture";
import { OPEN_FINDINGS, isOpenFinding } from "./_test-utils/sim/sim-open-findings";

/**
 * Simulated learners (the fast tier): seeded lives on real libraries through the real planner,
 * checked against the owner's rules (`_test-utils/rules`) after every step, with no database
 * writes and no AI. The seeds include the lives the database tier lives
 * (`simulated-learners-db.test.ts`), so a rule broken there is broken here too. Exams plan slowly,
 * so they live shorter lives here; the large tier (`simulated-learners-large.test.ts`) lives many
 * more on demand.
 */
const SEEDS: Record<SimFixtureName, readonly number[]> = {
  camara: [1],
  career: [1, 2, 3, 4, 1001],
  "class-test": [1, 2, 3, 4, 5, 6, 1003],
  enem: [1],
  ielts: [1, 2],
  language: [1, 2, 3, 4, 1006],
  oab: [1],
};

const EXAM_STEPS = 8;
const MINUTE = 60_000;

describe("simulated learners", () => {
  it.each(Object.keys(SEEDS) as SimFixtureName[])(
    "%s keep the owner's rules",
    async (fixture) => {
      const exam = fixture === "enem" || fixture === "oab" || fixture === "camara";

      const batch = await runSimBatch({
        fixtures: [fixture],
        maxSteps: exam ? EXAM_STEPS : undefined,
        seeds: () => SEEDS[fixture],
        shrink: false,
      });

      const unexpected = batch.findings
        .filter((finding) => !isOpenFinding(finding))
        .map(
          ({ rule, seed, violation }) =>
            `${rule}, seed ${seed}, step ${violation.step}: ${violation.message}`,
        );

      // A rule listed as still broken that these lives keep now: its fix landed, so unlist it.
      const fixed = Object.keys(OPEN_FINDINGS[fixture]).filter(
        (rule) => !batch.findings.some((finding) => finding.rule === rule),
      );

      expect({ fixed, unexpected }).toStrictEqual({ fixed: [], unexpected: [] });
    },
    10 * MINUTE,
  );
});
