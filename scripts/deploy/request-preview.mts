import { execFileSync } from "node:child_process";
import { z } from "zod";

/**
 * Starts a preview of a pull request through the PR Preview workflow: `pnpm preview` for the
 * current branch's PR, or `pnpm preview <number>`. The workflow runs from the PR's own branch, so
 * it deploys with that branch's deploy scripts.
 */
const prArgument = process.argv[2];

const pr = z
  .object({ headRefName: z.string(), number: z.number() })
  .parse(
    JSON.parse(
      execFileSync(
        "gh",
        ["pr", "view", ...(prArgument ? [prArgument] : []), "--json", "number,headRefName"],
        { encoding: "utf8" },
      ),
    ),
  );

execFileSync(
  "gh",
  ["workflow", "run", "preview.yml", "--ref", pr.headRefName, "-f", `pr=${pr.number}`],
  { stdio: "inherit" },
);
