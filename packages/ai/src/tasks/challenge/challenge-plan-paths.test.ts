import { challengePlanFixture } from "@zoonk/testing/fixtures/challenge-plan";
import { describe, expect, it } from "vitest";
import { describePlanForScript, getPlanFactProblems } from "./challenge-plan-paths";

describe(getPlanFactProblems, () => {
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
      'Choice "start.check" establishes "test", which isn\'t in the facts',
      'Ending "sent" rests on "missing", which isn\'t in the facts',
      'Ending "unclear" rests on "missing", which isn\'t in the facts',
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
        "  later facts known on every path: none",
        "  later facts known on only some paths: test",
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
