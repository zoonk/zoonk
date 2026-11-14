/* oxlint-disable no-console -- This CLI prints the findings it evaluates. */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type AlignmentFile, type Capture } from "./alignment-capture.mts";
import { alignmentLines, summarize, summaryLine } from "./alignment-summary.mts";
import { evaluateFile } from "./alignment.mts";

const USAGE = `Usage: pnpm verify:alignment <file or folder>... [--write]

Evaluates alignment captures from any platform (REPORT-SHAPE.md): an alignment.json
({ "captures": [...] }), a single capture ({ "version": 1, ... }), or a folder holding them.
Prints each fault once with its instances, then one line: PASS or FAIL, unresolved findings,
missing scenarios, discovery leads and what wasn't measured.

  --write   put the findings and the summary back into each alignment.json it read

Exits 0 when nothing fails, 1 when a declared relationship fails, 2 when an input can't be read.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { default: false, type: "boolean" },
    write: { default: false, type: "boolean" },
  },
});

function isCapture(value: unknown): value is Capture {
  return typeof value === "object" && value !== null && "version" in value && "elements" in value;
}

function isFile(value: unknown): value is AlignmentFile {
  return typeof value === "object" && value !== null && "captures" in value;
}

function asFile(parsed: unknown): AlignmentFile | null {
  if (isFile(parsed)) {
    return parsed;
  }

  return isCapture(parsed) ? { captures: [parsed] } : null;
}

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
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const file = asFile(parsed);

  if (named && (!file || file.captures.length === 0)) {
    throw new Error(`${path} holds no captures`);
  }

  return file && file.captures.length > 0 ? { file, path } : null;
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
          .filter(({ file }) => file.captures.length > 0 && !isCapture(file))
          .map(({ file, findings, path, summary }) =>
            writeFile(path, `${JSON.stringify({ ...file, findings, summary }, null, 2)}\n`),
          ),
      );
    }

    const findings = evaluated.flatMap((input) => input.findings);
    const summary = summarize(findings);

    console.log([...alignmentLines(findings), summaryLine(summary)].join("\n"));
    process.exitCode = summary.failed ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
