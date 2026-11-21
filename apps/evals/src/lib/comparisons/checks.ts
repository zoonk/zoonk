import path from "node:path";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import { isNearSolidImage } from "@zoonk/core/images/quality";
import z from "zod";
import { runInOrder } from "../concurrency";
import { checkImageEdges } from "../image-edges";
import { solveAnswerKeys } from "../key-check";
import { type CodeCheckResult, type RegisteredTask } from "../types";
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

async function solveKeys({
  checks,
  locators,
  prompt,
}: {
  checks: CodeCheckResult;
  locators: string[];
  prompt: string;
}) {
  return locators.length === 0
    ? { costUsd: 0, keyFlaws: [] }
    : solveAnswerKeys({ locators, output: checks.keySolveOutput ?? checks.judgedOutput, prompt });
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
    if (manifest.codeCheck === "code checks") {
      throw new Error(`The comparison requires code checks, but ${task.id} has none registered.`);
    }

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
        const [edges, blank] = await Promise.all([
          checkImageEdges(output),
          isNearSolidImage({ image: output }),
        ]);

        if (blank.error) {
          throw blank.error;
        }

        await writeRecord(`${prefix}.json`, checkSchema, {
          ...base,
          blockingProblems: blank.data ? ["The image is a blank frame."] : undefined,
          costUsd: 0,
          name: "background and frame",
          passed: edges.passed + Number(!blank.data),
          problems: edges.problems,
          total: edges.total + 1,
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

      const { keyFlaws, costUsd } = await solveKeys({
        checks,
        locators,
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
