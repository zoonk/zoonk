import { z } from "zod";
import { github } from "./api.mts";
import { requiredEnv } from "./config.mts";
import { cancelPreviews } from "./deployment.mts";
import { findBranch, neon } from "./neon.mts";

const prNumber = requiredEnv("PR_NUMBER");

async function isClosed(): Promise<boolean> {
  const pr = z.object({ state: z.string() }).parse(await github(`pulls/${prNumber}`));
  return pr.state === "closed";
}

if (await isClosed()) {
  await cancelPreviews();
  const branch = await findBranch(`preview/pr-${prNumber}`);

  // A reopen can arrive while the remote builds are being canceled.
  if (branch && (await isClosed())) {
    await neon({ method: "DELETE", path: `/branches/${branch.id}` });
    process.stdout.write("Deleted the closed PR's database branch\n");
  } else {
    process.stdout.write("No closed PR database branch to clean up\n");
  }
} else {
  process.stdout.write("PR was reopened; keeping its database branch\n");
}
