export type CodeLanguage = "javascript" | "python" | "sql";

export type CodeTokenKind = "builtin" | "comment" | "keyword" | "number" | "plain" | "string";

export type CodeToken = { kind: CodeTokenKind; text: string };

type TokenRule = { kind: CodeTokenKind | "word"; pattern: RegExp };

const JAVASCRIPT_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "of",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "while",
  "yield",
]);

const JAVASCRIPT_BUILTINS = new Set([
  "Array",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Set",
  "String",
  "console",
  "parseFloat",
  "parseInt",
  "setTimeout",
]);

const PYTHON_KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const PYTHON_BUILTINS = new Set([
  "abs",
  "bool",
  "dict",
  "enumerate",
  "float",
  "input",
  "int",
  "len",
  "list",
  "max",
  "min",
  "print",
  "range",
  "reversed",
  "round",
  "set",
  "sorted",
  "str",
  "sum",
  "tuple",
  "zip",
]);

const SQL_KEYWORDS = new Set([
  "all",
  "and",
  "as",
  "asc",
  "between",
  "by",
  "case",
  "desc",
  "distinct",
  "else",
  "end",
  "exists",
  "from",
  "group",
  "having",
  "in",
  "inner",
  "is",
  "join",
  "left",
  "like",
  "limit",
  "not",
  "null",
  "offset",
  "on",
  "or",
  "order",
  "outer",
  "select",
  "then",
  "union",
  "when",
  "where",
  "with",
]);

const SQL_BUILTINS = new Set([
  "avg",
  "coalesce",
  "count",
  "length",
  "lower",
  "max",
  "min",
  "round",
  "substr",
  "sum",
  "upper",
]);

const NUMBER = /(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/iuy;
const SPACE = /\s+/uy;
const OTHER = /[^\s\w$"'`#/-]+|[\s\S]/uy;

const RULES: Record<CodeLanguage, TokenRule[]> = {
  javascript: [
    { kind: "comment", pattern: /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/uy },
    { kind: "string", pattern: /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?/uy },
    { kind: "number", pattern: NUMBER },
    { kind: "word", pattern: /[$A-Z_a-z][\w$]*/uy },
  ],
  python: [
    { kind: "comment", pattern: /#[^\n]*/uy },
    {
      kind: "string",
      pattern:
        /[bfr]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/iuy,
    },
    { kind: "number", pattern: NUMBER },
    { kind: "word", pattern: /[A-Z_a-z]\w*/uy },
  ],
  sql: [
    { kind: "comment", pattern: /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/uy },
    { kind: "string", pattern: /'(?:''|[^'])*'?/uy },
    { kind: "number", pattern: NUMBER },
    { kind: "word", pattern: /[A-Z_a-z]\w*/uy },
  ],
};

function wordKind(word: string, language: CodeLanguage): CodeTokenKind {
  if (language === "sql") {
    const lower = word.toLowerCase();

    if (SQL_KEYWORDS.has(lower)) {
      return "keyword";
    }

    return SQL_BUILTINS.has(lower) ? "builtin" : "plain";
  }

  const [keywords, builtins] =
    language === "python"
      ? [PYTHON_KEYWORDS, PYTHON_BUILTINS]
      : [JAVASCRIPT_KEYWORDS, JAVASCRIPT_BUILTINS];

  if (keywords.has(word)) {
    return "keyword";
  }

  return builtins.has(word) ? "builtin" : "plain";
}

/** Every pattern is sticky (`y`), so it only matches at `index`. */
function matchAt(pattern: RegExp, code: string, index: number): string | null {
  pattern.lastIndex = index;
  return pattern.exec(code)?.[0] || null;
}

/** The token that starts at `index`: the first rule that matches, else plain text. */
function tokenAt(code: string, index: number, language: CodeLanguage): CodeToken {
  const space = matchAt(SPACE, code, index);

  if (space) {
    return { kind: "plain", text: space };
  }

  const rule = RULES[language]
    .map((item) => ({ kind: item.kind, text: matchAt(item.pattern, code, index) }))
    .find((item) => item.text !== null);

  if (rule?.text) {
    return {
      kind: rule.kind === "word" ? wordKind(rule.text, language) : rule.kind,
      text: rule.text,
    };
  }

  return { kind: "plain", text: matchAt(OTHER, code, index) ?? code.charAt(index) };
}

function tokenize(code: string, language: CodeLanguage): CodeToken[] {
  const tokens: CodeToken[] = [];
  const position = { index: 0 };

  while (position.index < code.length) {
    const token = tokenAt(code, position.index, language);
    tokens.push(token);
    position.index += token.text.length;
  }

  return tokens;
}

/** Splits tokens at line breaks, so a comment or string spanning lines colors each line. */
function splitLines(tokens: readonly CodeToken[]): CodeToken[][] {
  return tokens.reduce<CodeToken[][]>(
    (lines, token) => {
      const [first = "", ...rest] = token.text.split("\n");
      const last = lines.at(-1) ?? [];
      const current = first ? [...last, { kind: token.kind, text: first }] : last;

      return [
        ...lines.slice(0, -1),
        current,
        ...rest.map((text) => (text ? [{ kind: token.kind, text }] : [])),
      ];
    },
    [[]],
  );
}

/**
 * Colors code for reading: keywords, built-ins, literals and comments. It only needs to look
 * right for short lesson programs, so it scans tokens without parsing the language.
 */
export function highlightCode(code: string, language: CodeLanguage): CodeToken[][] {
  return splitLines(tokenize(code, language));
}
