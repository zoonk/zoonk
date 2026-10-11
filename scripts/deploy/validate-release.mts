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
      throw new Error(`Release commit failed CI (run ${run.id})`);
    }

    process.stdout.write(`Release commit passed CI (run ${run.id})\n`);
    return true;
  }

  process.stdout.write("Waiting for CI on the release's exact commit\n");
  return undefined;
}

await waitFor({
  check: checkCI,
  description: "CI on the release commit; push its v* tag or run CI manually",
});
