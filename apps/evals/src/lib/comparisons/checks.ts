import path from "node:path";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import z from "zod";
import { runInOrder } from "../concurrency";
import { checkImageEdges } from "../image-edges";
import { solveAnswerKeys } from "../key-check";
import { type RegisteredTask } from "../types";
import { uncheckedAnswerKeys } from "./decision";
import { hash } from "./identity";
import { lessonBlockingProblems } from "./lesson-save-check";
import { type Comparison, checkSchema } from "./schemas";
import { directory, readOptional, writeRecord } from "./storage";

function possibleZeroKeyRuns(comparison: Comparison) {
  return uncheckedAnswerKeys(comparison).filter(({ caseId, run, side }) =>
    comparison.checks.some(
      (check) =>
        check.name === "code checks" &&
        check.caseId === caseId &&
        check.run === run &&
        check.side === side &&
        check.passed === check.total &&
        check.problems.length === 0,
    ),
  );
}

export async function checkRuns(task: RegisteredTask | null, comparison: Comparison) {
  const { manifest } = comparison;
  const doneFile = path.join(directory(manifest.taskId, manifest.id), "checks-complete.json");
  const complete = await readOptional(doneFile, z.literal(true));
  const possibleZeroKeys = complete ? possibleZeroKeyRuns(comparison) : [];

  if (complete && (!task || possibleZeroKeys.length === 0)) {
    return;
  }

  if (!task) {
    throw new Error("The frozen checks have not completed and the task is unavailable.");
  }

  const check = task.codeChecks;

  if (!check && task.output !== "image") {
    await writeRecord(doneFile, z.literal(true), true);
    return;
  }

  await runInOrder(manifest.runsCompared, async (run) => {
    const frozen = manifest.cases.find((candidate) => candidate.id === run.caseId);

    if (!frozen) {
      throw new Error("Missing frozen case.");
    }

    const testCase = {
      expectations: frozen.expectations,
      id: frozen.id,
      language: frozen.language,
      userInput: frozen.input,
    };

    await runInOrder(["incumbent", "challenger"] as const, async (side) => {
      const slot = run[side];

      if (
        !slot ||
        (complete &&
          !possibleZeroKeys.some(
            (pending) =>
              pending.caseId === run.caseId && pending.run === run.run && pending.side === side,
          ))
      ) {
        return;
      }

      const base = { caseId: run.caseId, run: run.run, side };

      const prefix = path.join(
        directory(task.id, manifest.id),
        "checks",
        hash(JSON.stringify(base)),
      );

      const output = comparison.outputs[slot.hash];

      if (output === undefined) {
        throw new Error("Missing sealed output.");
      }

      if (Buffer.isBuffer(output)) {
        const edges = await checkImageEdges(output);

        await writeRecord(`${prefix}.json`, checkSchema, {
          ...base,
          ...edges,
          costUsd: 0,
          name: "background and frame",
        });

        return;
      }

      if (!check) {
        return;
      }

      const checks = await check({
        output,
        testCase: { ...testCase, expected: frozen.expected },
      } as never);

      if (!complete) {
        const blockingProblems =
          task.id === "lesson-writer"
            ? await lessonBlockingProblems({
                context: frozen.input as WriteLessonDraftParams,
                output,
              })
            : checks.blockingProblems;

        await writeRecord(`${prefix}.json`, checkSchema, {
          ...base,
          blockingProblems,
          costUsd: 0,
          criteria: checks.criteria,
          name: "code checks",
          passed: checks.passed,
          problems: checks.problems,
          total: checks.total,
        });
      }

      const locators = checks.keyFlawLocators;

      if (
        !locators ||
        (complete && locators.length > 0) ||
        (await readOptional(`${prefix}-keys.json`, checkSchema))
      ) {
        return;
      }

      if (
        locators.length === 0 &&
        (!manifest.requiresAnswerKeyCheck ||
          checks.passed !== checks.total ||
          checks.problems.length > 0)
      ) {
        return;
      }

      const { keyFlaws, costUsd } =
        locators.length === 0
          ? { costUsd: 0, keyFlaws: [] }
          : await solveAnswerKeys({
              locators,
              output: checks.judgedOutput,
              prompt: JSON.stringify(testCase),
            });

      await writeRecord(`${prefix}-keys.json`, checkSchema, {
        ...base,
        costUsd,
        name: "answer keys",
        passed: locators.length - keyFlaws.length,
        problems: keyFlaws.map((flaw) => JSON.stringify(flaw)),
        total: locators.length,
      });
    });
  });

  await writeRecord(doneFile, z.literal(true), true);
}
