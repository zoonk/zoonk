import { readdirSync } from "node:fs";
import path from "node:path";
import { createAnswerLinks } from "@zoonk/player/tutor/app-links";
import { describe, expect, it } from "vitest";

const APP_DIR = path.join(import.meta.dirname, "../../app/[lang]");
const ID = "0199e2a1-3b4c-7d5e-8f60-718293a4b5c6";

const { pages, toLink } = createAnswerLinks([]).links;

function listPageRoutes(): RegExp[] {
  const files = readdirSync(APP_DIR, { recursive: true }).map(String);

  return files
    .filter((file) => path.basename(file) === "page.tsx")
    .map((file) => {
      const segments = path
        .dirname(file)
        .split(path.sep)
        .filter((segment) => segment !== "." && !/^\(.+\)$/u.test(segment))
        .map((segment) => (/^\[.+\]$/u.test(segment) ? "[^/]+" : segment));

      return new RegExp(`^/${segments.join("/")}$`, "u");
    });
}

function toRoute(href: string): string {
  return href.split("?")[0] ?? href;
}

describe("the pages the buddy links", () => {
  const routes = listPageRoutes();

  it.each([
    ...Object.entries(pages),
    ["block", toLink({ blockId: ID, kind: "block" })],
    ["challenge", toLink({ kind: "challenge", planItemId: ID })],
    ["subject", toLink({ key: "matematica", kind: "subject" })],
  ])("%s (%s) is a page of the app", (_name, href) => {
    expect(routes.some((route) => route.test(toRoute(href)))).toBe(true);
  });
});
