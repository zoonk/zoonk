import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT_FONT_PX = 16;
const TENTH = 10;

/** The shared pieces, which may set a size for themselves, and the type roles (craft T1). */
const SOURCES = ["apps/playground/src/design-system/type.ts", "packages/ui/src/**/*.{ts,tsx}"];

const GLOBALS = "packages/ui/src/styles/globals.css";

function toPixels(value: string, unit: string) {
  const pixels = unit === "rem" ? Number(value) * ROOT_FONT_PX : Number(value);
  return Math.round(pixels * TENTH) / TENTH;
}

function utilitySizes(css: string): Map<string, number[]> {
  const sizes = new Map<string, number[]>();

  for (const match of css.matchAll(/@utility text-(?<name>[\w-]+)\s*\{/gu)) {
    let depth = 1;
    let end = match.index + match[0].length;

    while (depth > 0 && end < css.length) {
      depth += css[end] === "{" ? 1 : 0;
      depth -= css[end] === "}" ? 1 : 0;
      end += 1;
    }

    const block = css.slice(match.index, end);

    const found = [...block.matchAll(/font-size:\s*(?<value>[\d.]+)(?<unit>rem|px)/gu)].map(
      ({ groups }) => toPixels(groups?.value ?? "0", groups?.unit ?? "px"),
    );

    sizes.set(match.groups?.name ?? "", found);
  }

  return sizes;
}

function themeSizes(css: string): Map<string, number> {
  return new Map(
    [...css.matchAll(/--text-(?<name>[\w-]+):\s*(?<value>[\d.]+)(?<unit>rem|px);/gu)].map(
      ({ groups }) => [groups?.name ?? "", toPixels(groups?.value ?? "0", groups?.unit ?? "px")],
    ),
  );
}

/**
 * The font sizes the design system defines: each `text-*` class its type roles and shared pieces
 * use, resolved through its utilities and themes. A class that isn't a size (`text-muted-foreground`)
 * resolves to nothing.
 */
export function typeScale({
  css,
  sources,
  theme,
}: {
  css: string;
  sources: string[];
  theme: string;
}): number[] {
  const utilities = utilitySizes(css);
  const named = new Map([...themeSizes(theme), ...themeSizes(css)]);
  const sizes = new Set<number>();

  for (const source of sources) {
    for (const { groups } of source.matchAll(
      /\btext-(?:\[(?<value>[\d.]+)(?<unit>rem|px)\]|(?<name>[a-z\d-]+))/gu,
    )) {
      if (groups?.value) {
        sizes.add(toPixels(groups.value, groups.unit ?? "px"));
      }

      const name = groups?.name ?? "";

      for (const size of utilities.get(name) ??
        [named.get(name)].filter((value) => value !== undefined)) {
        sizes.add(size);
      }
    }
  }

  return [...sizes].toSorted((one, other) => one - other);
}

/** The type scale as the checkout being measured defines it, so a prototype's new role counts. */
export function readTypeScale(root: string): number[] {
  return typeScale({
    css: readFileSync(join(root, GLOBALS), "utf8"),
    sources: globSync(SOURCES, { cwd: root }).map((path) => readFileSync(join(root, path), "utf8")),
    theme: readFileSync(join(root, "packages/ui/node_modules/tailwindcss/theme.css"), "utf8"),
  });
}
