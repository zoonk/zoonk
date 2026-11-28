import "server-only";
import { randomUUID } from "node:crypto";
import { getVercelOidcToken } from "@vercel/oidc";
import { MS_PER_SECOND } from "@zoonk/utils/date";
import { executeSandboxProgram } from "./execute-sandbox-program";
import { type SandboxLanguage } from "./program-languages";
import { type ProgramRun } from "./program-runs";
import { type ProgramSandbox, sandboxDriver } from "./sandbox-driver";
import { runBudgetMs } from "./sandbox-languages";

export type SandboxJob = { code: string; kind: SandboxLanguage };
type IndexedSandboxJob = { id: number; job: SandboxJob };

async function runOne({
  job,
  sandbox,
}: {
  job: SandboxJob;
  sandbox: ProgramSandbox;
}): Promise<ProgramRun> {
  const { error, output, stop } = await executeSandboxProgram({
    code: job.code,
    language: job.kind,
    runId: randomUUID(),
    sandbox,
  });

  if (stop === "unavailable") {
    throw new Error(`The ${job.kind} program checker is unavailable`);
  }

  return { error, output, status: stop, steps: [], table: null };
}

async function checkLanguage(language: SandboxLanguage, jobs: IndexedSandboxJob[]) {
  const sandbox = await sandboxDriver.fork({
    language,
    name: `check-${randomUUID()}`,
    timeoutMs: Math.max(30 * MS_PER_SECOND, jobs.length * runBudgetMs(language)),
  });

  try {
    const results: { id: number; result: ProgramRun }[] = [];

    for (const { id, job } of jobs) {
      // oxlint-disable-next-line no-await-in-loop -- jobs share one learner account in this VM
      results.push({ id, result: await runOne({ job, sandbox }) });
    }

    return results;
  } finally {
    await sandbox.stop();
  }
}

export async function runSandboxPrograms(jobs: IndexedSandboxJob[]) {
  if (jobs.length === 0) {
    return [];
  }

  await getVercelOidcToken().catch((error: unknown) => {
    throw new Error(
      "Sandbox program checks require the API project's Vercel OIDC token. Link the API project and run vercel env pull for local checks.",
      { cause: error },
    );
  });

  const grouped = Map.groupBy(jobs, ({ job }) => job.kind);

  const results = await Promise.allSettled(
    [...grouped].map(([language, group]) => checkLanguage(language, group)),
  );

  return results.flatMap((result) => {
    if (result.status === "rejected") {
      throw result.reason;
    }

    return result.value;
  });
}
