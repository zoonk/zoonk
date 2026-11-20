export type CodeTokenKind = "builtin" | "comment" | "keyword" | "number" | "plain" | "string";

/** A `word` match is looked up in the language's keywords and built-ins; the other kinds color what they match. */
type TokenRule = { kind: CodeTokenKind | "word"; pattern: RegExp };

export type CodeLanguageSpec = {
  builtins: ReadonlySet<string>;
  /** SQL reads its words in any case. */
  ignoreCase: boolean;
  keywords: ReadonlySet<string>;
  /** Tried in order at each position; each pattern is sticky. */
  rules: readonly TokenRule[];
};

const NUMBER = /(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/iuy;
const WORD = /[$\p{L}_][\p{L}\p{N}_$]*/uy;
const SLASH_COMMENT = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/uy;

/** A string the learner hasn't closed yet still colors to the line's end, as an editor does. */
const QUOTED = /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/uy;

const JAVASCRIPT_KEYWORDS =
  "async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield";

const JAVASCRIPT_BUILTINS =
  "Array Boolean Date Error JSON Map Math Number Object Promise Set String console document fetch parseFloat parseInt setInterval setTimeout window";

const JAVASCRIPT_RULES: readonly TokenRule[] = [
  { kind: "comment", pattern: SLASH_COMMENT },
  { kind: "string", pattern: /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?/uy },
  { kind: "number", pattern: NUMBER },
  { kind: "word", pattern: WORD },
];

/** C-like languages with a string in either quote (a `char` in Java and C). */
const C_LIKE_RULES: readonly TokenRule[] = [
  { kind: "comment", pattern: SLASH_COMMENT },
  { kind: "string", pattern: QUOTED },
  { kind: "number", pattern: NUMBER },
  { kind: "word", pattern: WORD },
];

type Language = {
  builtins?: string;
  ignoreCase?: boolean;
  keywords?: string;
  /** What writers put after a fence's backticks for it, in lowercase. */
  names: readonly string[];
  rules: readonly TokenRule[];
};

const LANGUAGES: readonly Language[] = [
  {
    builtins: JAVASCRIPT_BUILTINS,
    keywords: JAVASCRIPT_KEYWORDS,
    names: ["javascript", "js", "jsx", "mjs", "cjs", "node"],
    rules: JAVASCRIPT_RULES,
  },
  {
    builtins: `${JAVASCRIPT_BUILTINS} Partial Readonly Record any boolean never number object string unknown`,
    keywords: `${JAVASCRIPT_KEYWORDS} abstract as declare enum implements interface keyof namespace private protected public readonly satisfies type`,
    names: ["typescript", "ts", "tsx", "mts", "cts"],
    rules: JAVASCRIPT_RULES,
  },
  {
    builtins:
      "abs bool dict enumerate float input int len list map max min open print range reversed round self set sorted str sum tuple type zip",
    keywords:
      "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
    names: ["python", "py", "python3", "py3"],
    rules: [
      { kind: "comment", pattern: /#[^\n]*/uy },
      {
        kind: "string",
        pattern:
          /[bfr]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/iuy,
      },
      { kind: "number", pattern: NUMBER },
      { kind: "word", pattern: WORD },
    ],
  },
  {
    builtins: "avg coalesce count length lower max min now round substr sum upper",
    ignoreCase: true,
    keywords:
      "all alter and as asc between by case create cross delete desc distinct drop else end exists false foreign from full group having in index inner insert into is join key left like limit not null offset on or order outer primary references right select set table then true union update values view when where with",
    names: ["sql", "postgres", "postgresql", "mysql", "sqlite", "mariadb"],
    rules: [
      { kind: "comment", pattern: /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/uy },
      { kind: "string", pattern: /'(?:''|[^'])*'?/uy },
      { kind: "number", pattern: NUMBER },
      { kind: "word", pattern: WORD },
    ],
  },
  {
    builtins: "ArrayList HashMap Integer List Map Math Object Scanner String System",
    keywords:
      "abstract boolean break byte case catch char class continue default do double else enum extends false final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true try var void while",
    names: ["java"],
    rules: C_LIKE_RULES,
  },
  {
    // C and C++ in one: a C program rarely names anything after a C++ keyword.
    builtins: "NULL cin cout endl free malloc printf puts scanf std strlen",
    keywords:
      "auto bool break case catch char class const continue default delete do double else enum extern false float for if int long namespace new nullptr private protected public return short signed sizeof static struct switch template this throw true try typedef union unsigned using virtual void while",
    names: ["c", "h", "cpp", "c++", "cc", "cxx", "hpp"],
    rules: [
      { kind: "comment", pattern: SLASH_COMMENT },
      { kind: "keyword", pattern: /#[ \t]*[a-z]+/uy },
      ...C_LIKE_RULES.slice(1),
    ],
  },
  {
    names: ["html", "htm", "xml", "svg"],
    rules: [
      { kind: "comment", pattern: /<!--[\s\S]*?(?:-->|$)/uy },
      { kind: "keyword", pattern: /(?<=<\/?)[A-Za-z][\w:.-]*/uy },
      { kind: "string", pattern: /(?<==)(?:"[^"\n]*"?|'[^'\n]*'?)/uy },
      { kind: "word", pattern: WORD },
    ],
  },
  {
    names: ["css", "scss", "less"],
    rules: [
      { kind: "comment", pattern: /\/\*[\s\S]*?(?:\*\/|$)/uy },
      { kind: "string", pattern: QUOTED },
      { kind: "keyword", pattern: /@[\w-]+/uy },
      { kind: "number", pattern: /-?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[a-z]+)?/iuy },
      { kind: "word", pattern: /[\p{L}_-][\p{L}\p{N}_-]*/uy },
    ],
  },
  // Program output and other text shown as written, with nothing colored.
  { names: ["text", "txt", "plaintext", "plain", "output", "console", "log"], rules: [] },
];

/**
 * A language we don't know, or a fence with none: only what reads the same in most languages. A
 * comment needs its marker at a word's start and a space after `#` or `--` (`#include`, `x--` and
 * a URL's `//` stay plain), and a quote right after a letter is an apostrophe, not a string.
 */
const UNKNOWN: Language = {
  names: [],
  rules: [
    {
      kind: "comment",
      pattern: /(?<!:)\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|(?<!\S)(?:#|--)(?=[ \t])[^\n]*/uy,
    },
    { kind: "string", pattern: /(?<![\p{L}\p{N}])(?:"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/uy },
    { kind: "number", pattern: NUMBER },
    { kind: "word", pattern: WORD },
  ],
};

function toWords(list = ""): ReadonlySet<string> {
  return new Set(list.split(" ").filter(Boolean));
}

function toSpec(language: Language): CodeLanguageSpec {
  return {
    builtins: toWords(language.builtins),
    ignoreCase: language.ignoreCase ?? false,
    keywords: toWords(language.keywords),
    rules: language.rules,
  };
}

const BY_NAME = new Map(
  LANGUAGES.flatMap((language) => {
    const languageSpec = toSpec(language);
    return language.names.map((name) => [name, languageSpec] as const);
  }),
);

const UNKNOWN_SPEC = toSpec(UNKNOWN);

/** `name` is a fence's name for the language (`py`, `JavaScript`), or null when it has none. */
export function findCodeLanguage(name: string | null): CodeLanguageSpec {
  return BY_NAME.get(name?.toLowerCase() ?? "") ?? UNKNOWN_SPEC;
}
