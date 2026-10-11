import { appendFile } from "node:fs/promises";
import { getCIRuns } from "./api.mts";
import { requiredEnv } from "./config.mts";

async function requiresChecks(): Promise<boolean> {
  if (!requiredEnv("GITHUB_REF").startsWith("refs/tags/")) {
    return true;
  }

  const runs = await getCIRuns(requiredEnv("GITHUB_SHA"));

  const latestMainRun = runs.find((run) => run.head_branch === "main" && run.event === "push");
  return latestMainRun?.conclusion !== "success";
}

await appendFile(requiredEnv("GITHUB_OUTPUT"), `required=${await requiresChecks()}\n`);
