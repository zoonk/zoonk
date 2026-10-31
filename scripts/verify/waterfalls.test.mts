import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type ChangedFile } from "./diff-audit.mts";
import { auditWaterfalls, findWaterfalls } from "./waterfalls.mts";

const PATH = "packages/core/src/today.ts";

function waterfallLines(source: string, added = source.split("\n").map((_, index) => index + 1)) {
  const file: ChangedFile = {
    added: added.map((line) => ({ line, text: source.split("\n")[line - 1] ?? "" })),
    created: false,
    path: PATH,
  };

  return auditWaterfalls([file], () => source).flatMap((flag) => flag.lines);
}

describe("finding waterfalls", () => {
  it("flags an await that waits for the one before it without using its result", () => {
    const source = [
      "export async function load(goalId: string) {",
      "  const plan = await readPlan(goalId);",
      "  const mistakes = await countMistakes({",
      "    goalId,",
      "  });",
      "  return { mistakes, plan };",
      "}",
    ].join("\n");

    assert.deepEqual(waterfallLines(source), [3]);
  });

  it("leaves an await that uses the previous result, destructured names included", () => {
    const source = [
      "export async function load() {",
      "  const { user } = await getSession();",
      "  const goals = await listGoals(user.id);",
      "  const [first] = await Promise.all(goals.map((goal) => readPlan(goal.id)));",
      "  const more = await readC({ id: first.id });",
      "  return more;",
      "}",
    ].join("\n");

    assert.deepEqual(waterfallLines(source), []);
  });

  it("leaves next-intl's functions, which stay sequential", () => {
    const source = [
      "export async function Page() {",
      "  const t = await getExtracted();",
      "  const locale = await getLocale();",
      "  const goals = await listGoals();",
      "  return { goals, locale, t };",
      "}",
    ].join("\n");

    assert.deepEqual(waterfallLines(source), []);
  });

  it("leaves bare awaits, whose order is usually the point", () => {
    const source = [
      "export async function Seed() {",
      "  await navigation();",
      "  const summary = await getLearnerSummary();",
      "  await save(summary);",
      "  return summary;",
      "}",
    ].join("\n");

    assert.deepEqual(findWaterfalls(PATH, source), []);
  });

  it("leaves a transaction's statements, which run one at a time on its connection", () => {
    const source = [
      "export async function save(tx: Transaction) {",
      "  const plan = await tx.plan.findUnique({ where: { id: PLAN_ID } });",
      "  const items = await tx.planItem.findMany({ where: { planId: PLAN_ID } });",
      "  return { items, plan };",
      "}",
    ].join("\n");

    assert.deepEqual(waterfallLines(source), []);
  });

  it("counts only the lines the change adds", () => {
    const source = [
      "export async function load() {",
      "  const a = await readA();",
      "  const b = await readB();",
      "  return { a, b };",
      "}",
    ].join("\n");

    const secondAwait = source.split("\n").findIndex((line) => line.includes("readB")) + 1;

    const others = source
      .split("\n")
      .map((_, index) => index + 1)
      .filter((line) => line !== secondAwait);

    assert.deepEqual(waterfallLines(source, others), []);
    assert.deepEqual(waterfallLines(source, [secondAwait]), [secondAwait]);
  });
});
