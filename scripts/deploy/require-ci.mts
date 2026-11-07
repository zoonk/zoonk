import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { getCIRuns, waitFor } from "./api.mts";
import { requiredEnv } from "./config.mts";

const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
await appendFile(requiredEnv("GITHUB_ENV"), `DEPLOY_SHA=${sha}\n`);

async function checkCI(): Promise<boolean | undefined> {
  const runs = await getCIRuns(sha);

  const run = runs.find((item) => item.event === "push" || item.event === "workflow_dispatch");

  if (run?.status === "completed") {
    if (run.conclusion !== "success") {
      throw new Error(`${sha} failed CI (run ${run.id})`);
    }

    process.stdout.write(`${sha} passed CI (run ${run.id})\n`);
    return true;
  }

  process.stdout.write(`Waiting for CI on ${sha}\n`);
  return undefined;
}

await waitFor({
  check: checkCI,
  description: `CI on ${sha}; outside main, push its v* tag or run CI manually`,
});
