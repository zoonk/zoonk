import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";

/** Keep literals as single tokens, so comments and strings cannot declare source contracts. */
function sourceTokens(source: string): string[] {
  return [
    ...source.matchAll(
      /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/gu,
    ),
  ]
    .map(([token]) => token)
    .filter((token) => !token.startsWith("//") && !token.startsWith("/*"));
}

/** Ignore comments and string contents when finding the literal segment export. */
function requiresNavigation(source: string): boolean {
  const tokens = sourceTokens(source);

  return tokens.some((_token, index) => {
    const [exportToken, constToken, name, ...rest] = tokens.slice(index);

    if (exportToken !== "export" || constToken !== "const" || name !== "ensureStatic") {
      return false;
    }

    const assignment = rest.findIndex((part) => ["=", ";", "}"].includes(part));

    return (
      assignment !== -1 &&
      rest[assignment] === "=" &&
      ["'navigation'", '"navigation"'].includes(rest[assignment + 1] ?? "")
    );
  });
}

function urlPattern(directory: string): string {
  const segments = directory
    .split(sep)
    .filter((part) => part !== "." && !part.startsWith("(") && !part.startsWith("@"));

  return `/${segments.join("/")}`.replaceAll("%5F", "_");
}

export async function getNavigationRoutes(appDirectory: string): Promise<string[]> {
  const app = resolve(appDirectory);
  const files = globSync("**/{page,layout}.{ts,tsx,js,jsx,mdx}", { cwd: app });

  const sources = await Promise.all(
    files.map(async (file) => ({
      file,
      navigation: requiresNavigation(await readFile(resolve(app, file), "utf8")),
    })),
  );

  const layouts = sources
    .filter(({ file, navigation }) => navigation && basename(file).startsWith("layout."))
    .map(({ file }) => dirname(file));

  const pages = sources.filter(
    ({ file, navigation }) =>
      basename(file).startsWith("page.") &&
      (navigation ||
        layouts.some((layout) => layout === "." || file.startsWith(`${layout}${sep}`))),
  );

  return [...new Set(pages.map(({ file }) => urlPattern(dirname(file))))].toSorted();
}

/** Read the producer's literal placeholder; never import its server-only queries or execute it. */
export async function getCatalogPlaceholderMatcher(appDirectory: string) {
  const app = resolve(appDirectory);

  const tokens = sourceTokens(
    await readFile(resolve(app, "../data/catalog/catalog-static-params.ts"), "utf8"),
  );

  const declarations = tokens.flatMap((token, index) =>
    token === "const" && tokens[index + 1] === "UNLISTED_ROUTE" ? [index] : [],
  );

  const start = declarations[0];

  if (
    declarations.length !== 1 ||
    start === undefined ||
    tokens[start + 2] !== "=" ||
    tokens[start + 3] !== "{"
  ) {
    throw new Error("Expected one literal const UNLISTED_ROUTE declaration.");
  }

  const PROPERTY_TOKEN_COUNT = 4;
  const DECLARATION_PREFIX_TOKENS = 4;
  const properties = tokens.slice(start + DECLARATION_PREFIX_TOKENS);
  const values = new Map<string, string>();
  let cursor = 0;

  while (properties[cursor] !== "}") {
    const [name, colon, value, delimiter] = properties.slice(cursor, cursor + PROPERTY_TOKEN_COUNT);

    if (
      !name ||
      !/^[a-zA-Z_$][\w$]*$/u.test(name) ||
      values.has(name) ||
      colon !== ":" ||
      !value ||
      !["'-'", '"-"'].includes(value) ||
      ![",", "}"].includes(delimiter ?? "")
    ) {
      throw new Error("UNLISTED_ROUTE must declare literal '-' catalog segment values.");
    }

    values.set(name, value.slice(1, -1));
    cursor += delimiter === "," ? PROPERTY_TOKEN_COUNT : PROPERTY_TOKEN_COUNT - 1;
  }

  if (values.size === 0 || properties[cursor + 1] !== ";") {
    throw new Error("Expected a nonempty literal UNLISTED_ROUTE declaration.");
  }

  const catalog = new Set(
    globSync("**/page.{ts,tsx,js,jsx,mdx}", { cwd: app })
      .filter((file) => file.split(sep).includes("(catalog)"))
      .map((file) => urlPattern(dirname(file))),
  );

  return (source: string, path: string): boolean => {
    const pattern = source.split("/");
    const actual = path.split("/");
    let catalogSegments = 0;

    const matches = pattern.every((segment, index) => {
      if (segment === "[lang]") {
        return Boolean(actual[index]);
      }

      const name = /^\[(?<name>[\w$]+)\]$/u.exec(segment)?.groups?.name;

      if (!name) {
        return segment === actual[index];
      }

      catalogSegments += 1;
      return values.has(name) && values.get(name) === actual[index];
    });

    return (
      catalog.has(source) && pattern.length === actual.length && catalogSegments > 0 && matches
    );
  };
}
