import { parseArgs } from "node:util";
import { isoDate, staffList, wholeNumber } from "./_utils/staff";

type Problem = { code?: string; problem: string; source: "code" | "review" };

type Decision = {
  blocking: Problem[];
  minor: Problem[];
  outcome: string;
  phase: string;
  reviewerRunId: string | null;
  writerRunId: string;
};

type Writer = { model: string; promptVersion: string; runId: string };

type Counts = {
  firstReviews: number;
  passed: number;
  skipped: number;
  skippedRechecks: number;
  uncheckedPublications: number;
  problems: Map<string, number>;
};

const { values } = parseArgs({
  options: {
    from: { type: "string" },
    limit: { default: "200", type: "string" },
    to: { type: "string" },
  },
});

const limit = wholeNumber(values.limit, 1000, "limit");
const to = isoDate(values.to ?? new Date().toISOString());
const from = isoDate(values.from ?? new Date(Date.parse(to) - 7 * 86_400_000).toISOString());

if (from >= to) {
  throw new Error("--from must precede --to.");
}

function addDecision(counts: Counts, decision: Decision) {
  if (decision.phase === "firstReview") {
    if (decision.reviewerRunId === null) {
      counts.skipped += 1;
    } else {
      counts.firstReviews += 1;
      counts.passed += Number(decision.outcome === "passed");
    }
  }

  const codeOnly = decision.phase === "codeCheck" || decision.phase === "codeRecheck";

  if (codeOnly && (decision.outcome === "heldBack" || decision.outcome === "setAside")) {
    counts.skipped += 1;
  }

  counts.skippedRechecks += Number(decision.phase === "recheck" && decision.reviewerRunId === null);
  counts.uncheckedPublications += Number(decision.outcome === "publishUnchecked");

  for (const [severity, problems] of [
    ["blocking", decision.blocking],
    ["minor", decision.minor],
  ] as const) {
    for (const { code, problem, source } of problems) {
      const label = `${severity}/${source}: ${code ?? problem}`;
      counts.problems.set(label, (counts.problems.get(label) ?? 0) + 1);
    }
  }
}

function readRates() {
  const groups = new Map<string, Counts>();
  const writers = new Map<string, Writer>();
  const missingRuns = new Set<string>();
  const coverage = { decisions: 0, truncated: false, unattributedDecisions: 0 };

  const offsets = Array.from({ length: Math.ceil(limit / 100) }, (_, index) => index * 100);

  for (const offset of offsets) {
    const page = staffList<Decision>("LessonQualityDecision", {
      fields: "phase,outcome,writerRunId,reviewerRunId,blocking,minor",
      limit: Math.min(100, limit - offset),
      offset,
      where: [
        `createdAt gte ${from}`,
        `createdAt lt ${to}`,
        "phase in firstReview,recheck,codeCheck,codeRecheck",
      ],
    });

    const ids = [...new Set(page.records.map((row) => row.writerRunId))].filter(
      (id) => !writers.has(id) && !missingRuns.has(id),
    );

    if (ids.length > 0) {
      const calls = staffList<Writer>("AiCall", {
        fields: "runId,model,promptVersion",
        limit: 100,
        where: [`runId in ${ids.join(",")}`],
      });

      if (calls.hasMore) {
        throw new Error("The writer-call join returned more than 100 rows for a decision page.");
      }

      for (const call of calls.records) {
        writers.set(call.runId, call);
      }

      for (const id of ids.filter((runId) => !writers.has(runId))) {
        missingRuns.add(id);
      }
    }

    for (const decision of page.records) {
      const writer = writers.get(decision.writerRunId);
      const key = JSON.stringify([writer?.model ?? null, writer?.promptVersion ?? null]);

      const counts = groups.get(key) ?? {
        firstReviews: 0,
        passed: 0,
        problems: new Map<string, number>(),
        skipped: 0,
        skippedRechecks: 0,
        uncheckedPublications: 0,
      };

      addDecision(counts, decision);
      groups.set(key, counts);
      coverage.decisions += 1;
      coverage.unattributedDecisions += Number(!writer);
    }

    coverage.truncated = page.hasMore;

    if (!page.hasMore) {
      break;
    }
  }

  return {
    from,
    to,
    ...coverage,
    writers: [...groups]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, counts]) => {
        const [model, promptVersion] = JSON.parse(key) as [string | null, string | null];
        const { problems, ...totals } = counts;

        const commonProblems = [...problems]
          .toSorted(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))
          .slice(0, 10);

        return {
          model,
          promptVersion,
          ...totals,
          commonProblems: commonProblems.map(([problem, count]) => ({ count, problem })),
        };
      }),
  };
}

process.stdout.write(`${JSON.stringify(readRates(), null, 2)}\n`);
