/* oxlint-disable no-console -- This CLI prints the findings it evaluates. */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { READ_LIMITS, alignmentLines, summarize, summaryLine } from "./alignment-summary.mts";
import { readCaptures } from "./alignment-validate.mts";
import { evaluateFile } from "./alignment.mts";

const USAGE = `Usage: pnpm verify:alignment <file or folder>... [--write]

Evaluates alignment captures from any platform (REPORT-SHAPE.md): an alignment.json
({ "captures": [...] }), a single capture ({ "version": 1, ... }), or a folder holding them.
Prints each fault once with its instances, then one line: PASS or FAIL, unresolved findings,
missing scenarios, discovery leads and what wasn't measured.

  --write   put the findings and the summary back into each alignment.json it read

It judges only what a capture holds. ${READ_LIMITS}

Each capture is checked against the shape first (version 1, its platform's unit, every field the
evaluator reads, and every part's group and row present); one that doesn't match is refused.

Exits 0 when nothing fails, 1 when a declared relationship fails, 2 when an input can't be read
or isn't a capture this evaluator reads.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { default: false, type: "boolean" },
    write: { default: false, type: "boolean" },
  },
});

/** A named file must be captures; a folder's other JSON files are skipped. */
async function jsonFiles(path: string): Promise<{ named: boolean; path: string }[]> {
  const status = await stat(path);

  if (!status.isDirectory()) {
    return [{ named: true, path }];
  }

  const entries = await readdir(path, { recursive: true });

  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => ({ named: false, path: join(path, entry) }));
}

async function read({ named, path }: { named: boolean; path: string }) {
  const checked = readCaptures(JSON.parse(await readFile(path, "utf8")));

  if (checked.kind === "invalid") {
    throw new Error(`${path} isn't a capture this evaluator reads:\n${checked.problems}`);
  }

  if (named && (checked.kind === "other" || checked.file.captures.length === 0)) {
    throw new Error(`${path} holds no captures`);
  }

  return checked.kind === "captures" && checked.file.captures.length > 0
    ? { file: checked.file, path, single: checked.single }
    : null;
}

if (values.help || positionals.length === 0) {
  console.log(USAGE);
  process.exitCode = values.help ? 0 : 2;
} else {
  try {
    const found = await Promise.all(positionals.map((path) => jsonFiles(resolve(path))));
    const parsed = await Promise.all(found.flat().map((path) => read(path)));
    const inputs = parsed.filter((input) => input !== null);

    if (inputs.length === 0) {
      throw new Error(`No captures in ${positionals.join(", ")}`);
    }

    const evaluated = inputs.map((input) => ({ ...input, ...evaluateFile(input.file) }));

    if (values.write) {
      await Promise.all(
        evaluated
          .filter(({ single }) => !single)
          .map(({ file, findings, path, summary }) =>
            writeFile(path, `${JSON.stringify({ ...file, findings, summary }, null, 2)}\n`),
          ),
      );
    }

    // Several files at once (a folder that keeps an earlier run): each finding names its own, from
    // the folder it was found under, so an earlier run's never reads as the latest's.
    const roots = positionals.map((path) => resolve(path));

    const sourceOf = (path: string) =>
      relative(roots.find((root) => path.startsWith(root)) ?? "", path) || basename(path);

    const findings = evaluated.flatMap((input) =>
      evaluated.length > 1
        ? input.findings.map((item) => ({ ...item, source: sourceOf(input.path) }))
        : input.findings,
    );

    // Each file's own list of required scenarios: "not listed" only when no file lists any.
    const listed = evaluated.flatMap(({ summary: { scenariosMissing } }) =>
      scenariosMissing === null ? [] : [scenariosMissing],
    );

    const summary = summarize(
      findings,
      listed.length > 0 ? listed.reduce((total, missing) => total + missing, 0) : null,
    );

    console.log([...alignmentLines(findings), summaryLine(summary)].join("\n"));
    process.exitCode = summary.failed ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
