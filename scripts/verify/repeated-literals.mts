import { Visitor, parseSync } from "oxc-parser";
import { type ChangedFile, type Flag } from "./diff-audit.mts";
import { SOURCE } from "./rules/shared.mts";
import { WEB_CATALOG, readCatalog } from "./strings.mts";
import { countWords } from "./words.mts";

type Literal = { line: number; path: string; value: string };

/** Fewer words than this are labels ("Try again", "Mind maps") that any screen may share. */
const MIN_SENTENCE_WORDS = 5;
const MIN_CONSTANT_CLASSES = 4;
const LISTED_PLACES = 3;
const SAMPLE_LENGTH = 100;

const CLASS_CONSTANT =
  /export const (?<name>[A-Z][A-Z0-9_]*_CLASS)\s*=\s*(?<quote>["'`])(?<value>[^"'`$]+)\k<quote>/gu;

/**
 * Theme names declared in the shared styles (`--container-column`, `--radius-option`), which make
 * a class list specific to one piece rather than a layout idiom any piece might use.
 */
const THEME_NAME = /--(?:container|radius|text|font|shadow|spacing)-(?<name>[\w-]+):/gu;
const THEME_STYLES = /^packages\/ui\/src\/styles\/[^/]+\.css$/u;
const STOCK_NAME = /^(?:\d*x[sl]|sm|md|lg|sans|serif|mono|\d+)$/u;

function addedLiterals(file: ChangedFile, source: string): Literal[] {
  const { errors, program } = parseSync(file.path, source);

  if (errors.length > 0) {
    return [];
  }

  const lines = new Set(file.added.map(({ line }) => line));
  const literals: Literal[] = [];

  const keep = (start: number, value: string) => {
    const line = source.slice(0, start).split("\n").length;

    if (lines.has(line)) {
      literals.push({ line, path: file.path, value });
    }
  };

  new Visitor({
    Literal(node) {
      if (typeof node.value === "string") {
        keep(node.start, node.value);
      }
    },
    TemplateLiteral(node) {
      const [quasi] = node.quasis;

      if (node.expressions.length === 0 && quasi?.value.cooked) {
        keep(node.start, quasi.value.cooked);
      }
    },
  }).visit(program);

  return literals;
}

function changedLiterals(files: ChangedFile[], read: (path: string) => string): Literal[] {
  return files
    .filter((file) => SOURCE.test(file.path) && file.added.length > 0)
    .flatMap((file) => addedLiterals(file, read(file.path)));
}

function classesOf(value: string): string[] {
  return value.trim().split(/\s+/u);
}

/**
 * An added class list that contains every class of an exported `*_CLASS` constant restates that
 * piece instead of using it.
 */
export function auditRestatedClasses(
  files: ChangedFile[],
  paths: string[],
  read: (path: string) => string,
): Flag[] {
  const literals = changedLiterals(files, read).filter(
    (literal) => classesOf(literal.value).length >= MIN_CONSTANT_CLASSES,
  );

  if (literals.length === 0) {
    return [];
  }

  const unique = [...new Set(paths)];

  const theme = new Set(
    unique
      .filter((path) => THEME_STYLES.test(path))
      .flatMap((path) =>
        [...read(path).matchAll(THEME_NAME)].map((match) => match.groups?.name ?? ""),
      )
      .filter((name) => name && !STOCK_NAME.test(name)),
  );

  const specific = (name: string) => {
    const base = name.split(":").at(-1) ?? name;
    return base.includes("[") || [...theme].some((token) => base.endsWith(`-${token}`));
  };

  const constants = unique
    .filter((path) => SOURCE.test(path))
    .flatMap((path) => {
      const source = read(path);

      return source.includes("_CLASS")
        ? [...source.matchAll(CLASS_CONSTANT)].map((match) => ({
            classes: classesOf(match.groups?.value ?? ""),
            name: match.groups?.name ?? "",
            path,
          }))
        : [];
    })
    .filter(
      (constant) =>
        constant.classes.length >= MIN_CONSTANT_CLASSES && constant.classes.some(specific),
    );

  return literals.flatMap((literal): Flag[] => {
    const classes = new Set(classesOf(literal.value));

    return constants
      .filter(
        (constant) =>
          constant.path !== literal.path && constant.classes.every((name) => classes.has(name)),
      )
      .map((constant) => ({
        lines: [literal.line],
        path: literal.path,
        rule: {
          name: "Restated class constant",
          question: `This class list contains all of \`${constant.name}\` (${constant.path}). Is it that piece? Use the constant, or the component that owns it, and add only what differs.`,
          role: "design",
        },
        sample: literal.value.slice(0, SAMPLE_LENGTH),
      }));
  });
}

/** The product area a file belongs to: its first folder below `src/`, skipping route groups. */
export function featureOf(path: string): string {
  const [root = "", rest = ""] = path.split("/src/");

  const folder = rest
    .split("/")
    .slice(0, -1)
    .find((segment) => !/^[[(]|^(?:app|components|lib)$/u.test(segment));

  return folder ? `${root}/src/${folder}` : root;
}

/**
 * An added sentence that the web catalogs already list for another feature: the same words usually
 * mean the same moment, which the product should draw with one piece.
 */
export function auditRepeatedWords(
  files: ChangedFile[],
  paths: string[],
  read: (path: string) => string,
): Flag[] {
  const literals = changedLiterals(files, read).filter(
    (literal) => countWords(literal.value) >= MIN_SENTENCE_WORDS,
  );

  if (literals.length === 0) {
    return [];
  }

  const sources = new Map<string, string[]>();

  for (const path of new Set(paths)) {
    if (WEB_CATALOG.test(path)) {
      for (const string of readCatalog(path, read(path))) {
        sources.set(string.text, [...(sources.get(string.text) ?? []), ...string.sources]);
      }
    }
  }

  const seen = new Set<string>();

  return literals.flatMap((literal): Flag[] => {
    const feature = featureOf(literal.path);

    const elsewhere = [
      ...new Set([
        ...(sources.get(literal.value) ?? []),
        ...literals.filter((other) => other.value === literal.value).map((other) => other.path),
      ]),
    ].filter((source) => featureOf(source) !== feature);

    if (!sources.has(literal.value) || elsewhere.length === 0 || seen.has(literal.value)) {
      return [];
    }

    seen.add(literal.value);

    const more =
      elsewhere.length > LISTED_PLACES ? ` and ${elsewhere.length - LISTED_PLACES} more` : "";

    return [
      {
        lines: [literal.line],
        path: literal.path,
        rule: {
          name: "Same words elsewhere",
          question: `${elsewhere.slice(0, LISTED_PLACES).join(", ")}${more} already says this. Is it the same moment for the learner? Then draw it with the same piece and compare the screens side by side. A stock sentence, such as an error, is right to repeat: say so.`,
          role: "design",
        },
        sample: literal.value.slice(0, SAMPLE_LENGTH),
      },
    ];
  });
}
