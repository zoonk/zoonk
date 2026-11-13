/* oxlint-disable no-console -- This CLI prints its usage. */
import { parseArgs } from "node:util";
import { PAGE_OPTIONS, USAGE } from "./pages-usage.mts";

/** `pnpm verify:pages`: answers `--help` and a mistyped option before `pages.mts` starts measuring. */
function findUsageProblem(): string | null {
  try {
    parseArgs({ allowPositionals: true, options: PAGE_OPTIONS });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Node follows an unknown option with advice about positional arguments this command never takes.
    return message.split(" To specify a positional argument")[0] ?? message;
  }
}

const problem = findUsageProblem();

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(USAGE);
} else if (problem) {
  console.error(`${problem}\n\n${USAGE}`);
  process.exitCode = 2;
} else {
  await import("./pages.mts");
}
