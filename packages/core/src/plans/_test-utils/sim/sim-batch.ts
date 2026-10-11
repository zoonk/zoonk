import { type SimViolation } from "./sim-context";
import { type SimFixtureName } from "./sim-fixture";
import { runSimLife } from "./sim-life";
import { type SimLife, generateSimLife } from "./sim-life-plan";
import { type SimCheck, type SimResult } from "./sim-runner";
import { formatRepro, shrinkSimLife } from "./sim-shrink";

/** A rule broken in a batch: how often, the first life that broke it, shrunk, and its repro. */
export type SimFinding = {
  fixture: SimFixtureName;
  /** Lives of this fixture that broke the rule. */
  lives: number;
  /** The first life that broke the rule, shrunk to its shortest when the batch shrinks. */
  life: SimLife;
  /**
   * Whether the shrunk life breaks the rule through the real capabilities too (the database tier);
   * null when it wasn't run there.
   */
  confirmed: boolean | null;
  repro: string | null;
  rule: string;
  seed: number;
  violation: SimViolation;
  violations: number;
};

export type SimBatch = { events: number; findings: SimFinding[]; lives: number; ms: number };

/**
 * Lives `seeds` learners on each fixture and checks every rule after each step. The first life
 * that breaks a rule on a fixture is shrunk to its shortest repro when `shrink` is on.
 */
export async function runSimBatch({
  check,
  fixtures,
  live = (life) => runSimLife(life, check ? { check } : {}),
  maxSteps,
  onLife,
  seeds,
  shrink = false,
}: {
  check?: SimCheck;
  fixtures: readonly SimFixtureName[];
  /** How a life is lived: the pure tier by default, or through the real capabilities. */
  live?: (life: SimLife) => Promise<SimResult>;
  /** Caps each life's steps, for a quick tier. */
  maxSteps?: number;
  onLife?: (life: SimLife, violations: readonly SimViolation[]) => void;
  seeds: (fixture: SimFixtureName) => readonly number[];
  shrink?: boolean;
}): Promise<SimBatch> {
  const started = performance.now();
  const findings = new Map<string, SimFinding>();
  let events = 0;
  let lives = 0;

  for (const fixture of fixtures) {
    for (const seed of seeds(fixture)) {
      // oxlint-disable-next-line no-await-in-loop -- lives run one at a time on one CPU
      const generated = await generateSimLife({ fixture, seed });

      const life = maxSteps
        ? { ...generated, steps: generated.steps.slice(0, maxSteps) }
        : generated;
      // oxlint-disable-next-line no-await-in-loop -- lives run one at a time on one CPU
      const result = await live(life);

      events += result.events.length;
      lives += 1;
      onLife?.(life, result.violations);

      const rules = Map.groupBy(result.violations, (violation) => violation.rule);

      for (const [rule, broken] of rules) {
        const key = `${fixture}:${rule}`;
        const existing = findings.get(key);
        const [first] = broken;

        if (existing) {
          existing.lives += 1;
          existing.violations += broken.length;
        } else if (first) {
          findings.set(key, {
            confirmed: null,
            fixture,
            life,
            lives: 1,
            repro: null,
            rule,
            seed,
            violation: first,
            violations: broken.length,
          });
        }
      }
    }
  }

  if (shrink) {
    // Shrinking lives one at a time on one CPU.
    await [...findings.values()].reduce(
      (previous, finding) =>
        previous.then(async () => {
          const shrunk = await shrinkSimLife({ check, life: finding.life, rule: finding.rule });

          finding.life = shrunk.life;
          finding.violation = shrunk.violation ?? finding.violation;
          finding.repro = formatRepro({ life: shrunk.life, violation: finding.violation });
        }),
      Promise.resolve(),
    );
  }

  return { events, findings: [...findings.values()], lives, ms: performance.now() - started };
}

function describeConfirmed(confirmed: boolean | null): string {
  if (confirmed === null) {
    return "";
  }

  return confirmed
    ? " Reproduced through the real capabilities."
    : " Not reproduced through the real capabilities.";
}

/** A batch's findings as Markdown: one section per rule, worst first. */
export function formatSimBatch(batch: SimBatch): string {
  const byRule = Map.groupBy(batch.findings, (finding) => finding.rule);

  const sections = [...byRule]
    .toSorted(
      (a, b) =>
        b[1].reduce((total, finding) => total + finding.lives, 0) -
        a[1].reduce((total, finding) => total + finding.lives, 0),
    )
    .map(([rule, findings]) => {
      const lines = findings.map((finding) => {
        const { violation } = finding;
        const where = `step ${violation.step} (${violation.label}, ${violation.today})`;
        const confirmed = describeConfirmed(finding.confirmed);

        return [
          `- **${finding.fixture}**: ${finding.lives} lives, ${finding.violations} violations. First: seed ${finding.seed}, ${where}: ${violation.message}${confirmed}`,
          `  - details: \`${JSON.stringify(violation.details)}\``,
          ...(finding.repro ? ["", "```ts", finding.repro, "```", ""] : []),
        ].join("\n");
      });

      return [`### ${rule}`, "", ...lines].join("\n");
    });

  return [
    `Lives ${batch.lives}, events ${batch.events}, ${Math.round(batch.ms / 1000)} s.`,
    "",
    ...sections,
  ].join("\n");
}
