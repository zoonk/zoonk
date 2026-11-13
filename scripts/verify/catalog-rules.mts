/* oxlint-disable no-console -- Run directly, it prints each rule's offenders in the tree. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CATALOG_RULES, catalogRulesBroken } from "./rules/catalog.mts";
import { isCatalog, readCatalog } from "./strings.mts";

export type Offender = {
  line: number;
  path: string;
  rule: string;
  sources: string[];
  text: string;
};

export function catalogOffenders(catalogs: { content: string; path: string }[]): Offender[] {
  return catalogs.flatMap(({ content, path }) =>
    readCatalog(path, content).flatMap((string) =>
      catalogRulesBroken(path, string).map((rule) => ({
        line: string.line,
        path,
        rule: rule.id,
        sources: string.sources,
        text: string.text,
      })),
    ),
  );
}

export function treeCatalogs(repository = resolve(import.meta.dirname, "../..")) {
  return execFileSync("git", ["ls-files", "--", "apps", "packages"], {
    cwd: repository,
    encoding: "utf8",
  })
    .split("\n")
    .filter((path) => isCatalog(path))
    .map((path) => ({ content: readFileSync(join(repository, path), "utf8"), path }));
}

if (import.meta.main) {
  const offenders = catalogOffenders(treeCatalogs());

  for (const rule of CATALOG_RULES) {
    const here = offenders.filter((offender) => offender.rule === rule.id);
    console.log(`\n## ${rule.name} (${here.length})\n`);

    for (const offender of here) {
      const used = offender.sources.length > 0 ? ` (in ${offender.sources.join(", ")})` : "";
      console.log(`- ${offender.path}:${offender.line} ${offender.text}${used}`);
    }
  }
}
