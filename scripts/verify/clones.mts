import { type ChangedFile, type Flag } from "./diff-audit.mts";
import { SOURCE } from "./rules/shared.mts";

type Token = { line: number; text: string };
type Copy = { end: number; path: string; start: number };
type Clone = { added: Copy; copy: Copy };

const MIN_TOKENS = 50;
const MIN_LINES = 6;
const HASH_BASE = 1_000_003;

/**
 * Code that repeats on purpose: one file per AI task and per API route, fixtures, eval cases and
 * generated output.
 */
const SCAFFOLDING =
  /(?:^|\/)(?:generated|fixtures|_browser-tests)\/|\/test-(?:cases|inputs)\.ts$|^(?:packages\/ai|apps\/evals)\/src\/tasks\/|^apps\/api\/src\/app\/.*\/route\.ts$/u;

const LEXEME =
  /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|[\p{L}_$][\p{L}\p{N}_$]*|\d[\w.]*|\S/gu;

function isCode(path: string): boolean {
  return SOURCE.test(path) && !SCAFFOLDING.test(path);
}

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;

  for (const [text] of source.matchAll(LEXEME)) {
    if (!/^(?:\s|\/\/|\/\*)/u.test(text)) {
      tokens.push({ line, text });
    }

    line += text.split("\n").length - 1;
  }

  return tokens;
}

function withoutImports(tokens: Token[]): Token[] {
  const kept: Token[] = [];
  let skipping = false;

  for (const [index, token] of tokens.entries()) {
    const previous = tokens[index - 1]?.text;
    const next = tokens[index + 1]?.text ?? "";
    const startsStatement = previous === undefined || previous === ";" || previous === "}";

    const reexport =
      token.text === "export" &&
      ["{", "*", "type"].includes(next) &&
      tokens
        .slice(
          index,
          tokens.findIndex((t, at) => at > index && t.text === ";"),
        )
        .some((t) => t.text === "from");

    if (startsStatement && ((token.text === "import" && !["(", "."].includes(next)) || reexport)) {
      skipping = true;
    }

    if (!skipping) {
      kept.push(token);
    }

    if (skipping && token.text === ";") {
      skipping = false;
    }
  }

  return kept;
}

function tokensOf(source: string): Token[] {
  return withoutImports(lex(source));
}

function power(base: number, exponent: number): number {
  return Array.from({ length: exponent }).reduce<number>((total) => Math.imul(total, base), 1);
}

const TOP = power(HASH_BASE, MIN_TOKENS - 1);

function windowHashes(ids: number[]): number[] {
  const hashes: number[] = [];
  let hash = 0;

  for (const [index, id] of ids.entries()) {
    const dropped = index >= MIN_TOKENS ? Math.imul(ids[index - MIN_TOKENS] ?? 0, TOP) : 0;
    hash = Math.imul(Math.imul(hash - dropped, HASH_BASE) + id, 1);

    if (index >= MIN_TOKENS - 1) {
      hashes.push(hash);
    }
  }

  return hashes;
}

function sameWindow(a: number[], at: number, b: number[], bt: number): boolean {
  return Array.from({ length: MIN_TOKENS }).every((_, offset) => a[at + offset] === b[bt + offset]);
}

function runs(starts: [number, number][]): [number, number][][] {
  const groups: [number, number][][] = [];

  for (const start of starts.toSorted((a, b) => a[0] - b[0])) {
    const group = groups.at(-1);
    const last = group?.at(-1);

    if (group && last && start[0] === last[0] + 1) {
      group.push(start);
    } else {
      groups.push([start]);
    }
  }

  return groups;
}

function lineSpan(tokens: Token[], first: number, last: number): { end: number; start: number } {
  return { end: tokens[last + MIN_TOKENS - 1]?.line ?? 0, start: tokens[first]?.line ?? 0 };
}

const LISTED_COPIES = 3;

function overlaps(a: Copy, b: Copy): boolean {
  return a.path === b.path && a.start <= b.end && b.start <= a.end;
}

function before(a: Copy, b: Copy): boolean {
  return a.path === b.path ? a.start < b.start : a.path < b.path;
}

/** One item per added block, listing every copy; two added copies of each other are one item. */
function render(clones: Clone[]): Flag[] {
  const kept = clones.filter(
    (clone) =>
      !clones.some(
        (other) =>
          overlaps(other.added, clone.copy) &&
          overlaps(other.copy, clone.added) &&
          before(other.added, clone.added),
      ),
  );

  const blocks: { added: Copy; copies: Copy[] }[] = [];

  for (const clone of kept) {
    const group = blocks.find((candidate) => overlaps(candidate.added, clone.added));

    if (group) {
      group.added = {
        end: Math.max(group.added.end, clone.added.end),
        path: group.added.path,
        start: Math.min(group.added.start, clone.added.start),
      };

      if (!group.copies.some((copy) => overlaps(copy, clone.copy))) {
        group.copies.push(clone.copy);
      }
    } else {
      blocks.push({ added: clone.added, copies: [clone.copy] });
    }
  }

  return blocks.map(({ added, copies }): Flag => {
    const listed = copies
      .slice(0, LISTED_COPIES)
      .map((copy) => `${copy.path}:${copy.start}-${copy.end}`)
      .join(", ");

    const more =
      copies.length > LISTED_COPIES ? ` and ${copies.length - LISTED_COPIES} more places` : "";

    return {
      lines: [added.start],
      path: added.path,
      rule: {
        name: "Near-duplicate code",
        question: `Lines ${added.start}-${added.end} repeat ${listed}${more}. If they draw the same piece or state the same rule, keep one where every copy can import it and move each copy onto it; otherwise say what differs.`,
        role: "engineering",
      },
      sample: "",
    };
  });
}

/**
 * Blocks of at least `MIN_TOKENS` tokens and `MIN_LINES` lines that the change adds and that also
 * appear elsewhere in the tree, ignoring whitespace, comments and imports. Another added block
 * counts too, so two parallel changes that wrote the same thing are caught when combined.
 */
export function auditClones(
  files: ChangedFile[],
  paths: string[],
  read: (path: string) => string,
): Flag[] {
  const changed = files.filter((file) => isCode(file.path) && file.added.length > 0);

  if (changed.length === 0) {
    return [];
  }

  const vocabulary = new Map<string, number>();

  const encode = (tokens: Token[]) =>
    tokens.map((token) => {
      const id = vocabulary.get(token.text) ?? vocabulary.size + 1;
      vocabulary.set(token.text, id);
      return id;
    });

  const added = changed.map((file) => {
    const tokens = tokensOf(read(file.path));
    const lines = new Set(file.added.map(({ line }) => line));
    const ids = encode(tokens);

    const windows = windowHashes(ids).flatMap((hash, start) =>
      tokens.slice(start, start + MIN_TOKENS).some((token) => lines.has(token.line))
        ? [{ hash, start }]
        : [],
    );

    return { ids, path: file.path, tokens, windows };
  });

  const wanted = new Map<number, { file: (typeof added)[number]; start: number }[]>();

  for (const file of added) {
    for (const window of file.windows) {
      const list = wanted.get(window.hash) ?? [];
      list.push({ file, start: window.start });
      wanted.set(window.hash, list);
    }
  }

  const clones = [...new Set(paths)]
    .filter((path) => isCode(path))
    .flatMap((path): Clone[] => {
      const tokens = tokensOf(read(path));
      const ids = encode(tokens);
      const matches = new Map<string, [number, number][]>();

      for (const [start, hash] of windowHashes(ids).entries()) {
        for (const want of wanted.get(hash) ?? []) {
          const self = want.file.path === path && Math.abs(want.start - start) < MIN_TOKENS;

          if (!self && sameWindow(want.file.ids, want.start, ids, start)) {
            const key = `${want.file.path}\n${start - want.start}`;
            const list = matches.get(key) ?? [];
            list.push([want.start, start]);
            matches.set(key, list);
          }
        }
      }

      return [...matches].flatMap(([key, starts]) => {
        const file = added.find((candidate) => key.startsWith(`${candidate.path}\n`));

        return runs(starts).flatMap((run): Clone[] => {
          const [first, last] = [run[0], run.at(-1)];

          if (!file || !first || !last) {
            return [];
          }

          const mine = lineSpan(file.tokens, first[0], last[0]);
          const theirs = lineSpan(tokens, first[1], last[1]);

          return mine.end - mine.start + 1 >= MIN_LINES
            ? [{ added: { ...mine, path: file.path }, copy: { ...theirs, path } }]
            : [];
        });
      });
    });

  return render(clones);
}
