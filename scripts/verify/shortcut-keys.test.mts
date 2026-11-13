import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A key the product answers lives in one list (`packages/ui/src/lib/shortcuts.ts`) and in the piece
 * that draws its control. These checks fail on a key bound, drawn or announced anywhere else, so a
 * shortcut can't work on one screen and not on the next.
 */

const ROOT = resolve(import.meta.dirname, "../..");

/** The kit owns the listeners and the list. */
const KIT = "packages/ui/src/";

/** Global key listeners outside the kit, each with why it isn't a shortcut of the list. */
const OWN_LISTENERS: Record<string, string> = {
  "packages/learn/src/feedback/use-screen-keys-pause.ts":
    "answers no key: it swallows the list's screen keys while a popup is open",
  "packages/learn/src/mind-maps/use-pan-zoom.ts":
    "a zoomed map's own arrows, + and - while it is open, like a field's keys",
};

const MAIN_ACTIONS = [
  "EnterButton",
  "OnboardingPrimaryButton",
  "QuestionMainAction",
  "TaskMainButton",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "node_modules" || entry.name.startsWith(".") ? [] : sourceFiles(path);
    }

    return /\.tsx?$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function workspaceSources(group: "apps" | "packages"): string[] {
  return readdirSync(join(ROOT, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        return sourceFiles(join(ROOT, group, entry.name, "src"));
      } catch {
        return [];
      }
    });
}

const FILES = [...workspaceSources("apps"), ...workspaceSources("packages")].map((path) => ({
  name: path.slice(ROOT.length + 1),
  source: readFileSync(path, "utf8"),
}));

const OUTSIDE_KIT = FILES.filter(({ name }) => !name.startsWith(KIT));

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function matches({ pattern, files = OUTSIDE_KIT }: { files?: typeof FILES; pattern: RegExp }) {
  return files.flatMap(({ name, source }) =>
    [...source.matchAll(pattern)].map((match) => `${name}:${lineOf(source, match.index)}`),
  );
}

/** A JSX opening tag's text, braces and arrows inside its props included. */
function openingTags(source: string, component: string): { index: number; text: string }[] {
  return [...source.matchAll(new RegExp(`<${component}\\b`, "gu"))].map(({ index }) => {
    let depth = 0;
    let end = index;

    while (
      end < source.length &&
      !(depth === 0 && source[end] === ">" && source[end - 1] !== "=")
    ) {
      depth += Number(source[end] === "{") - Number(source[end] === "}");
      end += 1;
    }

    return { index, text: source.slice(index, end + 1) };
  });
}

describe("shortcut keys", () => {
  it("announces a key only through shortcutKeys", () => {
    expect(matches({ pattern: /aria-keyshortcuts=(?:"|\{\s*["'])/gu })).toStrictEqual([]);
  });

  it("draws a shortcut's keycap only from the list", () => {
    const typed = OUTSIDE_KIT.flatMap(({ name, source }) =>
      openingTags(source, "ShortcutKbd")
        .filter(({ text }) => !text.endsWith("/>") || !text.includes("shortcut="))
        .map(({ index }) => `${name}:${lineOf(source, index)}`),
    );

    expect(typed).toStrictEqual([]);
  });

  it("binds a global key only in the kit", () => {
    const listeners = OUTSIDE_KIT.filter(
      ({ name, source }) =>
        /addEventListener\(\s*["']key(?:down|up|press)["']/u.test(source) &&
        /\.(?:key|code)\b/u.test(source) &&
        !(name in OWN_LISTENERS),
    ).map(({ name }) => name);

    expect(listeners).toStrictEqual([]);
  });

  it("keeps the raw key hook inside the kit", () => {
    const exported = matches({ files: FILES, pattern: /export function useKeyboardCallback\b/gu });
    const called = matches({ pattern: /\buseKeyboardCallback\(/gu });

    expect([...exported, ...called]).toStrictEqual([]);
  });

  it("has no switch that turns Esc on per screen", () => {
    expect(matches({ files: FILES, pattern: /\bcloseOnEscape\b/gu })).toStrictEqual([]);
  });

  it("shows an acting main action as busy, not only disabled", () => {
    const gray = FILES.flatMap(({ name, source }) =>
      MAIN_ACTIONS.flatMap((component) => openingTags(source, component))
        .filter(
          ({ text }) =>
            /disabled=\{(?:is)?(?:pending|saving|submitting)\}/iu.test(text) &&
            !text.includes("busy="),
        )
        .map(({ index }) => `${name}:${lineOf(source, index)}`),
    );

    expect(gray).toStrictEqual([]);
  });
});
