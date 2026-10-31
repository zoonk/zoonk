import { type Declaration, type Expression, type Statement, parseSync } from "oxc-parser";
import { type ChangedFile, type Flag } from "./diff-audit.mts";
import { SOURCE } from "./rules/shared.mts";

type Definition = { endLine: number; line: number; name: string; path: string; sample: string };

const SAMPLE_LENGTH = 120;

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

      if (!id || id.type !== "Identifier" || !/^[a-z]|^[A-Z][A-Z0-9_]+$/u.test(id.name)) {
        return [];
      }

      return [
        {
          endLine: source.slice(0, declaration.end).split("\n").length,
          line: source.slice(0, declaration.start).split("\n").length,
          name: id.name,
          path,
          sample: source
            .slice(declaration.start, declaration.end)
            .replaceAll(/\s+/gu, " ")
            .slice(0, SAMPLE_LENGTH),
        },
      ];
    });
  });
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
    const copies = matches.filter((match) => match.name === definition.name);

    return copies.length > 1
      ? [
          {
            lines: [definition.line],
            path: definition.path,
            rule: {
              name: "Repeated definition",
              question: `${copies.length} definitions of \`${definition.name}\`: ${copies.map((copy) => `${copy.path}:${copy.line} \`${copy.sample}\``).join("; ")}. Compare the complete rules and their consumers for drift. If they share semantics, keep one definition in its owning module and migrate every consumer without reversing dependencies; otherwise explain the distinct domains. Search equivalent expressions and other names too; this check only matches declaration names.`,
              role: "engineering",
            },
            sample: definition.sample,
          },
        ]
      : [];
  });
}
