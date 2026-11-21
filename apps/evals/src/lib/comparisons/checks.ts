import path from "node:path";
import z from "zod";
import { runInOrder } from "../concurrency";
import { checkImageEdges } from "../image-edges";
import { solveAnswerKeys } from "../key-check";
import { type RegisteredTask } from "../types";
import { hash } from "./identity";
import { type Comparison, checkSchema } from "./schemas";
import { directory, readOptional, writeRecord } from "./storage";

export async function checkRuns(task: RegisteredTask, comparison: Comparison) {
  const doneFile = path.join(directory(task.id, comparison.manifest.id), "checks-complete.json");

  if (await readOptional(doneFile, z.literal(true))) {
    return;
  }

  const check = task.codeChecks;

  if (!check && task.output !== "image") {
    await writeRecord(doneFile, z.literal(true), true);
    return;
  }

  await runInOrder(comparison.manifest.runsCompared, async (run) => {
    const frozen = comparison.manifest.cases.find((candidate) => candidate.id === run.caseId);

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

      if (!slot) {
        return;
      }

      const base = { caseId: run.caseId, run: run.run, side };

      const prefix = path.join(
        directory(task.id, comparison.manifest.id),
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

      await writeRecord(`${prefix}.json`, checkSchema, {
        ...base,
        costUsd: 0,
        name: "code checks",
        passed: checks.passed,
        problems: checks.problems,
        total: checks.total,
      });

      const locators = checks.keyFlawLocators;

      if (!locators?.length || (await readOptional(`${prefix}-keys.json`, checkSchema))) {
        return;
      }

      const { keyFlaws, costUsd } = await solveAnswerKeys({
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
