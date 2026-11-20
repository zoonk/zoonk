import { type Declaration, type Expression, type Statement, parseSync } from "oxc-parser";
import { auditClones, lex } from "./clones.mts";
import { type ChangedFile, type Flag } from "./diff-audit.mts";
import { auditRepeatedWords, auditRestatedClasses } from "./repeated-literals.mts";
import { SOURCE } from "./rules/shared.mts";

type Definition = {
  endLine: number;
  line: number;
  name: string;
  path: string;
  sample: string;
  tokens: string[];
};

const SAMPLE_LENGTH = 120;

/** How alike two same-name definitions must read, as the share of tokens they have in common. */
const ALIKE = 0.8;

/** Names a framework or a file convention gives every file that defines them. */
const CONVENTIONS = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
  "TEST_CASES",
  "generateMetadata",
  "generateStaticParams",
  "generateViewport",
]);

function isSource(path: string): boolean {
  return SOURCE.test(path) && !/(?:^|[/.])generated(?:[/.]|$)/u.test(path);
}

function declarations(node: Statement | Declaration | Expression) {
  if (node.type === "VariableDeclaration") {
    return node.declarations.filter(
      (declaration) =>
        declaration.id.type === "Identifier" &&
        (/^[A-Z][A-Z0-9_]+$/u.test(declaration.id.name) ||
          declaration.init?.type === "ArrowFunctionExpression" ||
          declaration.init?.type === "FunctionExpression"),
    );
  }

  return node.type === "FunctionDeclaration" && node.body && /^[a-z]/u.test(node.id?.name ?? "")
    ? [node]
    : [];
}

function definitions(path: string, source: string): Definition[] {
  const { errors, program } = parseSync(path, source);

  if (errors.length > 0) {
    return [];
  }

  return program.body.flatMap((statement): Definition[] => {
    const node =
      statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
        ? statement.declaration
        : statement;

    if (!node) {
      return [];
    }

    return declarations(node).flatMap((declaration): Definition[] => {
      const id = declaration.id;

      if (
        !id ||
        id.type !== "Identifier" ||
        !/^[a-z]|^[A-Z][A-Z0-9_]+$/u.test(id.name) ||
        CONVENTIONS.has(id.name)
      ) {
        return [];
      }

      const text = source.slice(declaration.start, declaration.end);
      const value = "init" in declaration && declaration.init ? declaration.init : declaration;

      return [
        {
          endLine: source.slice(0, declaration.end).split("\n").length,
          line: source.slice(0, declaration.start).split("\n").length,
          name: id.name,
          path,
          sample: text.replaceAll(/\s+/gu, " ").slice(0, SAMPLE_LENGTH),
          tokens: lex(source.slice(value.start, value.end)).map((token) => token.text),
        },
      ];
    });
  });
}

/**
 * Same-name definitions are one rule written twice when their values or bodies read alike; helpers
 * that share a name but do different things are left out.
 */
function alike(a: string[], b: string[]): boolean {
  const counts = new Map<string, number>();

  for (const token of a) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const shared = b.filter((token) => {
    const left = counts.get(token) ?? 0;
    counts.set(token, left - 1);
    return left > 0;
  }).length;

  return (2 * shared) / (a.length + b.length) >= ALIKE;
}

export function auditDuplicatedDefinitions(
  files: ChangedFile[],
  paths: string[],
  read: (path: string) => string,
): Flag[] {
  const changed = files
    .filter((file) => isSource(file.path))
    .flatMap((file) =>
      definitions(file.path, read(file.path)).filter((definition) =>
        file.added.some(({ line }) => line >= definition.line && line <= definition.endLine),
      ),
    );

  if (changed.length === 0) {
    return [];
  }

  const modified = new Map(changed.map((definition) => [definition.name, definition]));
  const names = new Set(modified.keys());

  const matches = [...new Set(paths)]
    .filter((path) => isSource(path))
    .flatMap((path) => {
      const source = read(path);

      return [...names].some((name) => source.includes(name))
        ? definitions(path, source).filter((definition) => names.has(definition.name))
        : [];
    });

  return [...modified.values()].flatMap((definition): Flag[] => {
    const copies = matches.filter(
      (match) =>
        match.name === definition.name &&
        (match.path === definition.path || alike(definition.tokens, match.tokens)),
    );

    return copies.length > 1
      ? [
          {
            lines: [definition.line],
            path: definition.path,
            rule: {
              name: "Repeated definition",
              question: `${copies.length} definitions of \`${definition.name}\`: ${copies.map((copy) => `${copy.path}:${copy.line} \`${copy.sample}\``).join("; ")}. Compare the complete rules and their consumers for drift. If they share semantics, keep one definition in its owning module and migrate every consumer without reversing dependencies; otherwise explain the distinct domains. Same-name definitions that read differently elsewhere are left out; search other names and equivalent expressions too.`,
              role: "engineering",
            },
            sample: definition.sample,
          },
        ]
      : [];
  });
}

export function auditDuplication(
  files: ChangedFile[],
  paths: string[],
  read: (path: string) => string,
): Flag[] {
  return [
    ...auditDuplicatedDefinitions(files, paths, read),
    ...auditClones(files, paths, read),
    ...auditRestatedClasses(files, paths, read),
    ...auditRepeatedWords(files, paths, read),
  ];
}
