import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import UNLISTED_ROUTE from "../../apps/main/src/data/catalog/catalog-placeholder.json" with { type: "json" };

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

/** Match only the catalog's shared unlisted address, without loading server-only queries. */
export function getCatalogPlaceholderMatcher(appDirectory: string) {
  const app = resolve(appDirectory);
  const values = new Map(Object.entries(UNLISTED_ROUTE));

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
