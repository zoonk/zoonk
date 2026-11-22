import { describe, expect, it } from "vitest";
import { challengePlanFixture } from "./_test-utils/challenge-plan";
import { assembleChallengeCase, draftEmptyScript } from "./assemble-challenge-case";
import { type ChallengePlan } from "./challenge-plan";
import { describePlanForScript, getPlanFactProblems } from "./challenge-plan-paths";

function scanPlan(): ChallengePlan {
  const plan = challengePlanFixture();

  return {
    ...plan,
    decisions: plan.decisions.map((decision) => ({
      ...decision,
      choices: decision.choices.map((choice) =>
        choice.id === "check" ? { ...choice, establishes: ["scan"] } : choice,
      ),
      visual: decision.id === "report" ? "scan" : null,
    })),
    visuals: [
      {
        id: "scan",
        known: "later",
        visual: {
          kind: "plot",
          references: [{ label: "Control limit", y: 40 }],
          series: [
            {
              mark: "line",
              name: "Scan",
              points: [
                { label: null, x: 10, y: 20 },
                { label: "Peak", x: 13, y: 30 },
              ],
            },
          ],
          source: null,
          title: "Pressure over time",
          xLabel: "Time",
          xUnit: "s",
          yLabel: "Pressure",
          yUnit: "kPa",
        },
      },
    ],
  };
}

describe(getPlanFactProblems, () => {
  it("holds a chart back when only one branch into its decision orders the scan", () => {
    expect(getPlanFactProblems(scanPlan())).toStrictEqual([
      expect.stringContaining('Decision "report" shows visual "scan", but a route into it'),
    ]);
  });

  it("detects a weak first choice that skips every chart before an ending", () => {
    const plan = scanPlan();

    const [start, report] = plan.decisions;

    if (!start || !report) {
      throw new Error("The scan plan needs a first decision and a report.");
    }

    const problems = getPlanFactProblems({
      ...plan,
      decisions: [
        {
          ...start,
          choices: start.choices.map((choice) =>
            choice.id === "skip" ? { ...choice, next: "estimate" } : choice,
          ),
        },
        report,
        { ...report, id: "estimate", visual: null },
      ],
    });

    expect(problems).toStrictEqual([
      expect.stringContaining('A path to ending "sent" skips every chart'),
      expect.stringContaining('A path to ending "unclear" skips every chart'),
    ]);
  });

  it("assembles a time jump that reveals a chart without a metric panel", () => {
    const base = scanPlan();

    const plan = {
      ...base,
      decisions: base.decisions.map((decision) => ({
        ...decision,
        choices: decision.choices.map((choice) =>
          decision.id === "start"
            ? { ...choice, establishes: ["scan"], timePasses: "After the scan" }
            : choice,
        ),
      })),
    };

    expect(getPlanFactProblems(plan)).toStrictEqual([]);

    const { missing, written } = assembleChallengeCase({ plan, script: draftEmptyScript(plan) });

    expect(missing).toStrictEqual([]);

    expect(written.nodes.find((node) => node.id === "report")?.visual).toStrictEqual(
      plan.visuals[0]?.visual,
    );

    expect(written.nodes.find((node) => node.id === "start")?.choices[0]?.timeJump).toStrictEqual({
      label: "After the scan",
      panel: null,
    });
  });

  it("requires unique ledger ids, valid visual references, and an immediate reveal", () => {
    const plan = scanPlan();

    const problems = getPlanFactProblems({
      ...plan,
      decisions: plan.decisions.map((decision) =>
        decision.id === "report" ? { ...decision, visual: "missing" } : decision,
      ),
      facts: [...plan.facts, { derivation: "given", fact: "An hour", id: "scan", known: "start" }],
      visuals: plan.visuals.map((entry) => ({ ...entry, known: "start" })),
    });

    expect(problems).toStrictEqual(
      expect.arrayContaining([
        expect.stringContaining('"scan" is used more than once'),
        'No decision shows visual "scan".',
        expect.stringContaining('Visual "scan" is known at the start'),
        'Decision "report" shows unknown visual "missing".',
        expect.stringContaining(
          'Choice "start.check" establishes visual "scan": show it on the next decision',
        ),
      ]),
    );
  });

  it("accepts an ending that rests on start facts and on a fact every path into it established", () => {
    const plan = challengePlanFixture();

    expect(getPlanFactProblems(plan)).toStrictEqual([]);

    const everyPathChecks = {
      ...plan,
      decisions: plan.decisions.map((decision) => ({
        ...decision,
        choices: decision.choices.map((choice) =>
          decision.id === "start" ? { ...choice, establishes: ["test"] } : choice,
        ),
      })),
      endings: plan.endings.map((ending) => ({ ...ending, restsOn: ["visits", "test"] })),
    };

    expect(getPlanFactProblems(everyPathChecks)).toStrictEqual([]);
  });

  it("flags an ending that cites a fact only some of its paths established", () => {
    const plan = challengePlanFixture();

    const problems = getPlanFactProblems({
      ...plan,
      endings: plan.endings.map((ending) =>
        ending.id === "sent" ? { ...ending, restsOn: ["test"] } : ending,
      ),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Ending "sent" rests on "test"');
  });

  it("flags an ending that cites a fact established only on paths that never reach it", () => {
    const plan = challengePlanFixture();

    const problems = getPlanFactProblems({
      ...plan,
      decisions: plan.decisions.map((decision) => ({
        ...decision,
        choices: decision.choices.map((choice) => ({
          ...choice,
          establishes: choice.id === "short" ? ["test"] : [],
        })),
      })),
      endings: plan.endings.map((ending) =>
        ending.id === "sent" ? { ...ending, restsOn: ["test"] } : ending,
      ),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Ending "sent" rests on "test"');
  });

  it("rejects an ending resting on a later fact no route establishes", () => {
    const plan = challengePlanFixture();

    const problems = getPlanFactProblems({
      ...plan,
      endings: plan.endings.map((ending) => ({ ...ending, restsOn: ["launch"] })),
      facts: [
        ...plan.facts,
        { derivation: "given", fact: "Sales rose 2%", id: "launch", known: "later" },
      ],
    });

    expect(problems).toHaveLength(2);
    expect(problems.every((problem) => problem.includes('rests on "launch"'))).toBe(true);
  });

  it("flags fact ids that aren't in the facts", () => {
    const plan = challengePlanFixture();

    const problems = getPlanFactProblems({
      ...plan,
      endings: plan.endings.map((ending) => ({ ...ending, restsOn: ["missing"] })),
      facts: plan.facts.filter((fact) => fact.id !== "test"),
    });

    expect(problems).toStrictEqual([
      'Choice "start.check" establishes "test", which isn\'t in the facts or visuals',
      'Ending "sent" rests on "missing", which isn\'t in the facts or visuals',
      'Ending "unclear" rests on "missing", which isn\'t in the facts or visuals',
    ]);
  });
});

describe(describePlanForScript, () => {
  it("gives the script each fact without the planner's working, and what each path knows", () => {
    const plan = challengePlanFixture();

    const described = describePlanForScript({
      ...plan,
      facts: plan.facts.map((fact) =>
        fact.id === "test" ? { ...fact, derivation: "z = 1.2533141, so p = 0.2101" } : fact,
      ),
    });

    expect(described).toContain("The test finds p = 0.21");
    expect(described).not.toContain("derivation");
    expect(described).not.toContain("1.2533141");

    expect(described).toContain(
      [
        "- report: reached by start.check, start.skip",
        "  later facts and visuals known on every path: none",
        "  later facts and visuals known on only some paths: test",
      ].join("\n"),
    );
  });

  it("names the first decision and stops on a plan that loops", () => {
    const plan = challengePlanFixture();

    expect(describePlanForScript(plan)).toContain("- start: the first decision");

    const looping = {
      ...plan,
      decisions: plan.decisions.map((decision) => ({
        ...decision,
        choices: decision.choices.map((choice) => ({ ...choice, next: "start" })),
      })),
    };

    const paths = describePlanForScript(looping).split("PATHS:\n")[1]?.split("\n") ?? [];

    expect(paths.filter((line) => line.startsWith("- "))).toStrictEqual([
      "- start: reached by start.check, start.skip",
    ]);
  });
});
