import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_SRC = resolve(import.meta.dirname, "../..");
const CORE = resolve(MAIN_SRC, "../../../packages/core");
const SESSION_READ = join(CORE, "src/users/get-session.ts");

/**
 * Server components that read the session but render only public output, with the reason. Every
 * other one must render `<LearnerWitness />`.
 */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  "app/[lang]/(app)/(catalog)/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/page.tsx":
    "Static catalog page (generateStaticParams): it can't read a session.",
  "app/[lang]/(app)/(catalog)/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/page.tsx":
    "Static catalog page (generateStaticParams): it can't read a session.",
  "app/[lang]/(app)/(catalog)/b/[brandSlug]/c/[courseSlug]/page.tsx":
    "Static catalog page (generateStaticParams): it can't read a session.",
  "components/learner/learner-summary-seed.tsx":
    "The frame's summary seed carries its own tag to the learner store.",
  "components/learner/learner-witness.tsx": "The witness itself.",
};

/** Helpers and metadata that compute, never render a boundary. */
const NOT_A_BOUNDARY =
  /^(?:generate[A-Z]|load[A-Z]|find[A-Z]|get[A-Z]|has[A-Z]|is[A-Z]|with[A-Z]|read[A-Z])/u;

type Source = { body: Map<string, string>; imports: Map<string, { name: string; path: string }> };

const coreExports = new Map(
  Object.entries(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- package.json's exports map.
    (
      JSON.parse(readFileSync(join(CORE, "package.json"), "utf8")) as {
        exports: Record<string, string>;
      }
    ).exports,
  ).map(([key, file]) => [`@zoonk/core/${key.slice(2)}`, normalize(join(CORE, file))]),
);

/** Where an import points in this repository, before its extension: null for a package's. */
function importBase(specifier: string, from: string): string | null {
  if (specifier.startsWith("@/")) {
    return join(MAIN_SRC, specifier.slice(2));
  }

  return specifier.startsWith(".") ? join(dirname(from), specifier) : null;
}

function resolveImport(specifier: string, from: string): string | null {
  const core = coreExports.get(specifier);

  if (core) {
    return core;
  }

  const base = importBase(specifier, from);

  const candidates = base ? [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")] : [];

  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  );
}

const sources = new Map<string, Source | null>();

/** A file's top-level functions (by name, with their text) and its value imports. */
function readSource(path: string): Source | null {
  const known = sources.get(path);

  if (known !== undefined) {
    return known;
  }

  const text = existsSync(path) ? readFileSync(path, "utf8") : null;

  if (text === null) {
    sources.set(path, null);
    return null;
  }

  const imports = new Map<string, { name: string; path: string }>();

  for (const match of text.matchAll(
    /import\s+(?<typeOnly>type\s+)?\{(?<names>[^}]*)\}\s+from\s+["'](?<from>[^"']+)["']/gu,
  )) {
    const target = match.groups?.typeOnly ? null : resolveImport(match.groups?.from ?? "", path);

    for (const part of target ? (match.groups?.names ?? "").split(",") : []) {
      const [name = "", local = name] = part
        .replace(/^\s*type\s/u, "")
        .split(" as ")
        .map((item) => item.trim());

      if (name && !part.trim().startsWith("type ") && target) {
        imports.set(local, { name, path: target });
      }
    }
  }

  const declarations = [
    ...text.matchAll(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(?<fn>\w+)|^(?:export\s+)?const\s+(?<constant>\w+)\s*=/gmu,
    ),
  ];

  const body = new Map(
    declarations.map((match, index) => [
      match.groups?.fn ?? match.groups?.constant ?? "",
      text.slice(match.index, declarations[index + 1]?.index ?? text.length),
    ]),
  );

  const source = { body, imports };
  sources.set(path, source);
  return source;
}

const reading = new Map<string, boolean>();

/** Whether a function reaches the session read through what it calls (approximate, by name). */
function readsSession(path: string, name: string, stack: string[] = []): boolean {
  const key = `${path}#${name}`;

  if (path === SESSION_READ && name === "getSession") {
    return true;
  }

  if (reading.has(key) || stack.includes(key)) {
    return reading.get(key) ?? false;
  }

  const source = readSource(path);
  const text = source?.body.get(name);

  if (!source || text === undefined) {
    const imported = source?.imports.get(name);
    return imported ? readsSession(imported.path, imported.name, [...stack, key]) : false;
  }

  reading.set(key, false);

  const called = new Set(
    [...text.matchAll(/\b(?<callee>[A-Za-z_]\w*)\s*\(/gu)].map(
      (match) => match.groups?.callee ?? "",
    ),
  );

  const reads = [...called].some((callee) => {
    const imported = source.imports.get(callee);

    if (callee === name) {
      return false;
    }

    return imported
      ? readsSession(imported.path, imported.name, [...stack, key])
      : source.body.has(callee) && readsSession(path, callee, [...stack, key]);
  });

  reading.set(key, reads);
  return reads;
}

function serverComponentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return serverComponentFiles(path);
    }

    const text =
      entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
        ? readFileSync(path, "utf8")
        : "";

    return text && !/^\s*["']use (?:client|server)["']/u.test(text) ? [path] : [];
  });
}

/** Every server component that reads the session, as `path :: Component`. */
function privateBoundaries(): { file: string; name: string; text: string }[] {
  return ["app", "components"].flatMap((folder) =>
    serverComponentFiles(join(MAIN_SRC, folder)).flatMap((path) => {
      const source = readSource(path);
      const file = relative(MAIN_SRC, path);

      return [...(source?.body ?? [])]
        .filter(([name]) => !NOT_A_BOUNDARY.test(name) && readsSession(path, name))
        .map(([name, text]) => ({ file, name, text }));
    }),
  );
}

const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Where the comment or string starting at `index` ends, or `index` when none starts there. */
function skipLiteral(text: string, index: number): number {
  if (text.startsWith("//", index)) {
    const end = text.indexOf("\n", index);
    return end === -1 ? text.length : end;
  }

  if (text.startsWith("/*", index)) {
    const end = text.indexOf("*/", index + 2);
    return end === -1 ? text.length : end + 2;
  }

  const quote = text[index];

  if (quote !== '"' && quote !== "`") {
    return index;
  }

  let end = index + 1;

  while (end < text.length && text[end] !== quote) {
    end += text[end] === "\\" ? 2 : 1;
  }

  return end + 1;
}

/** The index of the bracket closing the one at `open`. */
function closingIndex(text: string, open: number): number {
  let depth = 0;
  let index = open;

  while (index < text.length) {
    const skipped = skipLiteral(text, index);

    if (skipped === index) {
      const char = text[index] ?? "";
      depth += char === text[open] ? 1 : Number(char === PAIRS[text[open] ?? ""]) * -1;

      if (depth === 0) {
        return index;
      }

      index += 1;
    } else {
      index = skipped;
    }
  }

  return text.length;
}

/** Whether the `{` at `index` opens a function's body (an arrow's or a method's), not a block's. */
function opensFunction(text: string, index: number): boolean {
  const before = text.slice(0, index).trimEnd();

  if (before.endsWith("=>")) {
    return true;
  }

  if (!before.endsWith(")")) {
    return false;
  }

  let depth = 0;
  let open = before.length - 1;

  for (; open >= 0; open -= 1) {
    depth += before[open] === ")" ? 1 : Number(before[open] === "(") * -1;

    if (depth === 0) {
      break;
    }
  }

  const head = before.slice(0, open).trimEnd();

  return (
    !/\b(?:catch|for|if|switch|while|with)$/u.test(head) &&
    /(?:\bfunction\b[\s\w]*|\w)$/u.test(head)
  );
}

/** Where the expression starting at `from` ends: its `;`, or the end of the block holding it. */
function expressionEnd(text: string, from: number): number {
  let depth = 0;
  let index = from;

  while (index < text.length) {
    const skipped = skipLiteral(text, index);
    const char = text[index] ?? "";

    if (skipped !== index) {
      index = skipped;
    } else if ((char === ";" && depth === 0) || (")]}".includes(char) && depth === 0)) {
      return index;
    } else {
      depth += "([{".includes(char) ? 1 : Number(")]}".includes(char)) * -1;
      index += 1;
    }
  }

  return index;
}

function startsReturn(text: string, index: number): boolean {
  return (
    text.startsWith("return", index) &&
    !/[\w$.]/u.test(text[index - 1] ?? "") &&
    !/[\w$]/u.test(text[index + "return".length] ?? "")
  );
}

/** What each return owned by the function whose body is `body` hands back (not nested ones'). */
function ownReturns(body: string): string[] {
  const frames: ("block" | "function")[] = [];
  const returned: string[] = [];
  let index = 0;

  while (index < body.length) {
    const skipped = skipLiteral(body, index);

    if (skipped !== index) {
      index = skipped;
    } else if (startsReturn(body, index) && !frames.slice(1).includes("function")) {
      const end = expressionEnd(body, index + "return".length);
      returned.push(body.slice(index + "return".length, end).trim());
      index = end;
    } else {
      if (body[index] === "{") {
        frames.push(frames.length > 0 && opensFunction(body, index) ? "function" : "block");
      } else if (body[index] === "}") {
        frames.pop();
      }

      index += 1;
    }
  }

  return returned;
}

/** A function declaration's body, from its `{`: null for anything else (an arrow in a const). */
function functionBody(declaration: string): string | null {
  if (!/^[^(=]*\bfunction\b/u.test(declaration)) {
    return null;
  }

  const open = declaration.indexOf("{", closingIndex(declaration, declaration.indexOf("(")));

  return open === -1 ? null : declaration.slice(open, closingIndex(declaration, open) + 1);
}

/** A tag opening with literal attributes only: it renders nothing but its children. */
const PLAIN_OPENING = /^<[A-Za-z][\w.]*(?:\s+[\w-]+(?:="[^"]*")?)*\s*>/u;
const WITNESS_FIRST = /^\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)*<LearnerWitness\s*\/>/u;

/**
 * Whether a returned element renders the witness before anything else: as its fragment's or plain
 * root's first child, or by handing the branch to another checked boundary of the same file.
 */
function witnessesFirst(returned: string, boundaries: Set<string>): boolean {
  const wrapped = returned.startsWith("(") && closingIndex(returned, 0) === returned.length - 1;
  const element = wrapped ? returned.slice(1, -1).trim() : returned;
  const delegate = /^<(?<tag>[A-Z]\w*)\b[^<]*\/>$/su.exec(element)?.groups?.tag;

  if (delegate) {
    return boundaries.has(delegate);
  }

  const opening = element.startsWith("<>") ? "<>" : PLAIN_OPENING.exec(element)?.[0];

  return opening !== undefined && WITNESS_FIRST.test(element.slice(opening.length));
}

/** The branches a function renders without a witness first, by their first line. */
function unwitnessedBranches(declaration: string, boundaries: Set<string>): string[] | null {
  const body = functionBody(declaration);

  return body === null
    ? null
    : ownReturns(body)
        .filter((returned) => /<(?:>|[A-Za-z][\w.]*[\s/>])/u.test(returned))
        .filter((returned) => !witnessesFirst(returned, boundaries))
        .map((returned) => returned.replace(/^\(\s*/u, "").split("\n", 1)[0] ?? "");
}

describe("unwitnessedBranches", () => {
  it("finds each branch that renders before a witness, skipping nested functions' returns", () => {
    const sample = `function Sample({ list }) {
      if (list.length === 0) {
        return (
          <>
            <LearnerWitness />
            <Empty />
          </>
        );
      }

      const items = list.map((item) => {
        return <Item key={item} />;
      });

      if (list.length === 1) {
        return (
          <Card title={list[0]}>
            <LearnerWitness />
          </Card>
        );
      }

      if (list.length === 2) {
        return list[0] ? <One /> : <Two />;
      }

      if (list.length === 3) {
        return <Other />;
      }

      return (
        <main className="list">
          <LearnerWitness />
          {items}
        </main>
      );
    }`;

    expect(unwitnessedBranches(sample, new Set(["Other"]))).toStrictEqual([
      "<Card title={list[0]}>",
      "list[0] ? <One /> : <Two />",
    ]);

    expect(unwitnessedBranches(sample, new Set())).toContain("<Other />");
    expect(unwitnessedBranches("const Sample = () => <A />;", new Set())).toBeNull();
  });
});

describe("private boundaries' witnesses", () => {
  const boundaries = privateBoundaries();

  it("finds the private boundaries it guards", () => {
    expect(boundaries.length).toBeGreaterThan(40);
  });

  it("gives every private boundary a witness, or a reason it's public", () => {
    const missing = boundaries
      .filter(({ file, text }) => !(file in PUBLIC_BY_DESIGN) && !text.includes("<LearnerWitness"))
      .map(({ file, name }) => `${file} :: ${name}`);

    expect(missing).toStrictEqual([]);
  });

  it("puts a witness first in every branch a private boundary renders", () => {
    const unwitnessed = boundaries
      .filter(({ file }) => !(file in PUBLIC_BY_DESIGN))
      .flatMap(({ file, name, text }) => {
        const sameFile = new Set(
          boundaries.filter((other) => other.file === file).map((other) => other.name),
        );

        const branches = unwitnessedBranches(text, sameFile) ?? ["(not a function declaration)"];

        return branches.map((branch) => `${file} :: ${name} :: ${branch}`);
      });

    expect(unwitnessed).toStrictEqual([]);
  });

  it("keeps no reason for a file that no longer reads the session", () => {
    const readers = new Set(boundaries.map(({ file }) => file));

    const stale = Object.keys(PUBLIC_BY_DESIGN).filter(
      (file) => !readers.has(file) && !file.endsWith("learner-witness.tsx"),
    );

    expect(stale).toStrictEqual([]);
  });
});
