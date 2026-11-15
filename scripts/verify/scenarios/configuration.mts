import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

const repository = resolve(import.meta.dirname, "../../..");

/** A screen in a language: under its path prefix, English at the root. */
export function localePath(screen: string, locale?: string): string {
  return !locale || locale === "en" ? screen : `/${locale}${screen}`;
}

function catalogs(locale: string): string[] {
  return execFileSync(
    "git",
    ["ls-files", "--", `apps/*/messages/${locale}.po`, `packages/*/messages/${locale}.po`],
    { cwd: repository, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .map((path) => readFileSync(join(repository, path), "utf8"));
}

/** The words that prove a state, as the screen shows them in `locale`: the catalogs' translation. */
export function proofIn(proof: string, locale?: string): string {
  if (!locale || locale === "en") {
    return proof;
  }

  const entry = new RegExp(
    `^msgid ${RegExp.escape(JSON.stringify(proof))}\\nmsgstr "(?<text>.+)"$`,
    "mu",
  );

  const text = catalogs(locale)
    .map((content) => entry.exec(content)?.groups?.text)
    .find(Boolean);

  if (!text) {
    throw new Error(
      `"${proof}" has no ${locale} translation in the catalogs to prove the screen by.`,
    );
  }

  return z.string().parse(JSON.parse(`"${text}"`));
}
