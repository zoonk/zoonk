import { type ChangedFile, type Flag } from "./diff-audit.mts";
import { type Rule } from "./rules/shared.mts";
import { WORD_BUDGET, countWords } from "./words.mts";

/** An English string in a catalog; only the web's catalogs list the `sources` that use it. */
export type CatalogString = { line: number; note: string; sources: string[]; text: string };

export const STYLE_GUIDE = "packages/i18n/.eloqnt/styleguide.en.md";

const WEB_CATALOG = /(?:^|\/)messages\/en\.po$/u;
const ANDROID_CATALOG = /\/res\/values\/strings[^/]*\.xml$/u;

const HEDGE = /\b(?:for now|so far|may|up to)\b/iu;

const DEFINING_NOTE =
  /[“"‘'][^”"’']+[”"’']\s+(?:is|are|means)\b|\b(?:means|refers to|stands for)\b/iu;

/**
 * Where marketing pages' strings live (the landing page, the catalog, pricing, shared links, the
 * blog): visitors read them to decide whether to try Zoonk, so the app's length budget skips them.
 */
const MARKETING_SOURCE =
  /^apps\/blog\/|^apps\/main\/src\/(?:app\/\[lang\]\/(?:\(home\)|\(app\)\/\(catalog\)|blog|c|plan-link|pricing)\/|components\/(?:catalog|pricing|public)\/)/u;

/** How far above a string's line its `<…Button>` may open, for `t({ description, message })`. */
const BUTTON_WINDOW = 6;
const SAMPLE_LENGTH = 100;

const RULES = {
  button: {
    name: "Long button label",
    question: `Over ${WORD_BUDGET.buttonWords} words. A button is a verb the learner already knows ("Start", "Continue", "Save"), never the next screen's name, a duration or a consequence (zoonk-design's Words). Strings that only marketing pages use skip this.`,
    role: "design",
  },
  hedge: {
    name: "Hedge",
    question:
      'It says "for now", "so far", "may" or "up to". Would a learner be misled without it? Otherwise cut it.',
    role: "design",
  },
  long: {
    name: "Long string",
    question: `Over ${WORD_BUDGET.stringWords} words. Which part would a learner miss? Cut it, make it a step, or put it behind a tap (zoonk-design's Words). Strings that only marketing pages use skip this.`,
    role: "design",
  },
  note: {
    name: "Note defines a word",
    question:
      "If a translator needs the word explained, so does the learner: say the plain thing in the string instead.",
    role: "design",
  },
  term: {
    name: "Term learners never see",
    question:
      'The English style guide\'s "Plain words first" table says learners never see this term: rewrite the string the way it says.',
    role: "design",
  },
} satisfies Record<string, Rule>;

function unquote(quoted: string): string {
  try {
    const text: unknown = JSON.parse(quoted);
    return typeof text === "string" ? text : "";
  } catch {
    return quoted.slice(1, -1);
  }
}

function lastIndexOf(text: string, pattern: RegExp): number {
  return Math.max(-1, ...[...text.matchAll(pattern)].map((match) => match.index));
}

export function insideButton(source: string, text: string): boolean {
  const literal = JSON.stringify(text);
  const lines = source.split("\n");

  return lines.some((line, index) => {
    if (!line.includes(literal)) {
      return false;
    }

    const before = lines.slice(Math.max(0, index - BUTTON_WINDOW), index + 1).join("\n");
    const upTo = before.slice(0, before.lastIndexOf(literal));
    return lastIndexOf(upTo, /<\w*Button\b/gu) > lastIndexOf(upTo, /<\/\w*Button>/gu);
  });
}

function webStrings(path: string, content: string) {
  const root = path.replace(/messages\/en\.po$/u, "");
  const lines = content.split("\n");
  const entry = { notes: [] as string[], references: [] as string[] };
  const strings: CatalogString[] = [];

  for (const [index, line] of lines.entries()) {
    if (line.startsWith("#. ")) {
      entry.notes.push(line.slice(3));
    } else if (line.startsWith("#: ")) {
      entry.references.push(line.slice(3).replace(/:\d+$/u, ""));
    } else if (line.startsWith("msgid ")) {
      const continued = lines.slice(index + 1).findIndex((next) => !next.startsWith('"'));

      const text = [line.slice("msgid ".length), ...lines.slice(index + 1, index + 1 + continued)]
        .map((part) => unquote(part))
        .join("");

      if (text) {
        strings.push({
          line: index + 1,
          note: entry.notes.join(" "),
          sources: entry.references.map((source) => `${root}${source}`),
          text,
        });
      }
    } else if (!line.trim()) {
      entry.notes = [];
      entry.references = [];
    }
  }

  return strings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unitValues(node: unknown): string[] {
  if (!isRecord(node)) {
    return [];
  }

  const unit = node.stringUnit;
  const own = isRecord(unit) && typeof unit.value === "string" ? [unit.value] : [];
  return [...own, ...Object.values(node).flatMap((child) => unitValues(child))];
}

function appleStrings(content: string): CatalogString[] {
  const catalog: unknown = (() => {
    try {
      const parsed: unknown = JSON.parse(content);
      return parsed;
    } catch {
      return null;
    }
  })();

  const entries = isRecord(catalog) && isRecord(catalog.strings) ? catalog.strings : {};
  const lines = content.split("\n");

  return Object.entries(entries).flatMap(([key, entry]) => {
    if (!isRecord(entry) || entry.shouldTranslate === false) {
      return [];
    }

    const english = isRecord(entry.localizations) ? unitValues(entry.localizations.en) : [];
    const line = lines.findIndex((text) => text.trimStart().startsWith(`${JSON.stringify(key)} :`));
    const note = typeof entry.comment === "string" ? entry.comment : "";

    return [...new Set(english.length > 0 ? english : [key])].map((text) => ({
      line: line + 1,
      note,
      sources: [],
      text,
    }));
  });
}

function androidStrings(content: string): CatalogString[] {
  const lines = content.split("\n");

  return lines.flatMap((line, index) => {
    const match = /<(?:string|item)\b(?<attributes>[^>]*)>(?<text>.*?)<\/(?:string|item)>/u.exec(
      line,
    );

    if (!match?.groups || match.groups.attributes?.includes('translatable="false"')) {
      return [];
    }

    return [
      {
        line: index + 1,
        note: /<!--\s*(?<note>.*?)\s*-->/u.exec(lines[index - 1] ?? "")?.groups?.note ?? "",
        sources: [],
        text: (match.groups.text ?? "").replaceAll(/\\(?<quote>['"])/gu, "$<quote>"),
      },
    ];
  });
}

function isCatalog(path: string): boolean {
  return WEB_CATALOG.test(path) || path.endsWith(".xcstrings") || ANDROID_CATALOG.test(path);
}

export function readCatalog(path: string, content: string): CatalogString[] {
  if (WEB_CATALOG.test(path)) {
    return webStrings(path, content);
  }

  if (path.endsWith(".xcstrings")) {
    return appleStrings(content);
  }

  return ANDROID_CATALOG.test(path) ? androidStrings(content) : [];
}

/** The rows of the style guide's "Plain words first" table whose "Taught on" starts with "never". */
export function neverTerms(styleGuide: string): string[] {
  const section = styleGuide.split(/^## /mu).find((part) => part.startsWith("Plain words first"));

  return (section ?? "").split("\n").flatMap((line) => {
    const [term = "", taughtOn = ""] = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    return /^never\b/iu.test(taughtOn)
      ? term
          .split(",")
          .map((word) => word.replaceAll(/[`*"“”]/gu, "").trim())
          .filter(Boolean)
      : [];
  });
}

function termIn(text: string, terms: string[]): string | undefined {
  return terms.find((term) =>
    new RegExp(String.raw`\b${RegExp.escape(term)}s?\b`, "iu").test(text),
  );
}

export function judgeString(
  string: CatalogString,
  { read, terms }: { read: (path: string) => string; terms: string[] },
): { rule: Rule; sample: string }[] {
  const term = termIn(string.text, terms);
  const words = countWords(string.text);

  const usedInApp =
    string.sources.length === 0 || !string.sources.every((source) => MARKETING_SOURCE.test(source));

  return [
    ...(usedInApp && words > WORD_BUDGET.stringWords
      ? [{ rule: RULES.long, sample: string.text }]
      : []),
    ...(usedInApp &&
    words > WORD_BUDGET.buttonWords &&
    string.sources.some((source) => insideButton(read(source), string.text))
      ? [{ rule: RULES.button, sample: string.text }]
      : []),
    ...(HEDGE.test(string.text) ? [{ rule: RULES.hedge, sample: string.text }] : []),
    ...(term ? [{ rule: RULES.term, sample: `${term}: ${string.text}` }] : []),
    ...(DEFINING_NOTE.test(string.note) ? [{ rule: RULES.note, sample: string.note }] : []),
  ];
}

function stringKey(string: CatalogString): string {
  return `${string.text}\n${string.note}`;
}

export function auditStrings(
  files: ChangedFile[],
  { read, readBase }: { read: (path: string) => string; readBase: (path: string) => string },
): Flag[] {
  const terms = neverTerms(read(STYLE_GUIDE));

  return files
    .filter((file) => isCatalog(file.path))
    .flatMap((file) => {
      const before = new Set(
        readCatalog(file.path, readBase(file.path)).map((string) => stringKey(string)),
      );

      return readCatalog(file.path, read(file.path))
        .filter((string) => !before.has(stringKey(string)))
        .flatMap((string) =>
          judgeString(string, { read, terms }).map(({ rule, sample }) => ({
            lines: string.line > 0 ? [string.line] : [],
            path: file.path,
            rule,
            sample: sample.slice(0, SAMPLE_LENGTH),
          })),
        );
    });
}
