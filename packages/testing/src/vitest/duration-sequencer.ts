import { relative } from "node:path";
import { type TestSequencer, type TestSpecification, type Vitest } from "vitest/node";

/**
 * A Vitest sequencer that splits CI's shards by how long each file takes (the package's
 * `vitest.durations.json`, which `durations-reporter.ts` writes) instead of Vitest's even count of
 * files: a few planner simulations take a minute each on CI's runners while most files take a
 * second, so a split by count gave one shard four of them. Each file goes to the shard with the
 * least time so far, longest first, and each shard starts its longest files first so none is left
 * running alone at the end. Every shard computes the same split from the same file; a file not
 * measured yet weighs as much as the typical one.
 */
export function durationSequencer(durations: Readonly<Record<string, number>>) {
  const times = Object.values(durations).toSorted((a, b) => a - b);
  const typical = times[Math.floor(times.length / 2)] ?? 1000;

  return class DurationSequencer implements TestSequencer {
    private readonly vitest: Vitest;

    constructor(vitest: Vitest) {
      this.vitest = vitest;
    }

    private weigh(spec: TestSpecification): number {
      return durations[relative(this.vitest.config.root, spec.moduleId)] ?? typical;
    }

    private longestFirst(specs: readonly TestSpecification[]): TestSpecification[] {
      return specs.toSorted(
        (a, b) => this.weigh(b) - this.weigh(a) || a.moduleId.localeCompare(b.moduleId),
      );
    }

    shard(specs: TestSpecification[]): TestSpecification[] {
      const { count, index } = this.vitest.config.shard ?? { count: 1, index: 1 };

      const shards = Array.from({ length: count }, () => ({
        specs: [] as TestSpecification[],
        time: 0,
      }));

      this.longestFirst(specs).forEach((spec) => {
        const lightest = shards.reduce((least, shard) => (shard.time < least.time ? shard : least));
        lightest.specs.push(spec);
        lightest.time += this.weigh(spec);
      });

      return shards[index - 1]?.specs ?? [];
    }

    sort(specs: TestSpecification[]): TestSpecification[] {
      return this.longestFirst(specs);
    }
  };
}
