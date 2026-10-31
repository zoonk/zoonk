import { execFileSync } from "node:child_process";
import { z } from "zod";

/** `pnpm preview` for the current branch's PR, or `pnpm preview <number>`. */
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
