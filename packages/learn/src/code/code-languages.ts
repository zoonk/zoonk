export type CodeTokenKind = "builtin" | "comment" | "keyword" | "number" | "plain" | "string";

/** A `word` match is looked up in the language's keywords and built-ins; the other kinds color what they match. */
type TokenRule = { kind: CodeTokenKind | "word"; pattern: RegExp };

export type CodeLanguageSpec = {
  builtins: ReadonlySet<string>;
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
    builtins:
      "abs acos acosh asin asinh atan atan2 atanh avg ceil ceiling coalesce cos cosh count degrees exp floor length ln log log10 log2 lower max min mod now pi pow power radians round sign sin sinh sqrt substr sum tan tanh trunc upper",
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
    builtins: "Console Convert DateTime Dictionary Exception List Math String",
    keywords:
      "abstract as async await base bool break byte case catch char class const continue decimal default do double else enum false finally float for foreach if in int interface internal is long namespace new null object out override params private protected public readonly record ref return sealed short static string struct switch this throw true try uint ulong using var virtual void while",
    names: ["csharp", "cs", "c#"],
    rules: [
      { kind: "comment", pattern: SLASH_COMMENT },
      { kind: "string", pattern: /[$@]{0,2}"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/uy },
      ...C_LIKE_RULES.slice(2),
    ],
  },
  {
    builtins:
      "append bool byte cap close copy delete error float64 fmt int int64 len make math new panic recover rune sort strconv string strings",
    keywords:
      "break case chan const continue default defer else fallthrough false for func go goto if import interface iota map nil package range return select struct switch true type var",
    names: ["go", "golang"],
    rules: [
      { kind: "comment", pattern: SLASH_COMMENT },
      { kind: "string", pattern: /"(?:\\.|[^"\\\n])*"?|`[^`]*`?|'(?:\\.|[^'\\\n])*'?/uy },
      ...C_LIKE_RULES.slice(2),
    ],
  },
  {
    builtins:
      "Box Err HashMap None Ok Option Result Some String Vec bool char eprintln f32 f64 format i32 i64 isize panic print println str u32 u64 u8 usize vec",
    keywords:
      "as break const continue crate dyn else enum false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while",
    names: ["rust", "rs"],
    rules: [
      { kind: "comment", pattern: SLASH_COMMENT },
      // A quote opens a char only when it closes one character later; otherwise it's a lifetime (`'a`).
      { kind: "string", pattern: /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])'/uy },
      ...C_LIKE_RULES.slice(2),
    ],
  },
  {
    builtins: "Array Bool Character Dictionary Double Float Int Set String abs max min print",
    keywords:
      "as break case catch class continue default defer do else enum extension false for func guard if import in init inout internal is let nil private protocol public repeat return self Self static struct switch throw throws true try var where while",
    names: ["swift"],
    rules: [
      { kind: "comment", pattern: SLASH_COMMENT },
      { kind: "string", pattern: /"""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?/uy },
      ...C_LIKE_RULES.slice(2),
    ],
  },
  {
    builtins:
      "Any Array Boolean Char Double Int List Long Map MutableList Set String Unit arrayOf listOf mapOf mutableListOf print println setOf",
    keywords:
      "as break class companion continue data do else enum false for fun if import in interface internal is null object open override package private protected public return sealed super this throw true try val var when while",
    names: ["kotlin", "kt", "kts"],
    rules: [
      { kind: "comment", pattern: SLASH_COMMENT },
      {
        kind: "string",
        pattern: /"""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/uy,
      },
      ...C_LIKE_RULES.slice(2),
    ],
  },
  {
    builtins:
      "array_filter array_map count explode implode in_array json_encode printf sprintf str_repeat strlen strtolower strtoupper var_dump",
    keywords:
      "abstract and array as break case catch class const continue default do echo else elseif empty extends false final finally fn for foreach function global if implements instanceof interface isset match namespace new null or print private protected public readonly require return static switch throw trait true try unset use while yield",
    names: ["php"],
    rules: [
      { kind: "comment", pattern: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/uy },
      { kind: "keyword", pattern: /<\?php|\?>/uy },
      ...C_LIKE_RULES.slice(1),
    ],
  },
  {
    builtins:
      "Array Float Hash Integer String attr_accessor attr_reader lambda p print proc puts raise require",
    keywords:
      "alias and begin break case class def do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield",
    names: ["ruby", "rb"],
    rules: [{ kind: "comment", pattern: /#[^\n]*/uy }, ...C_LIKE_RULES.slice(1)],
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

export function findCodeLanguage(name: string | null): CodeLanguageSpec {
  return BY_NAME.get(name?.toLowerCase() ?? "") ?? UNKNOWN_SPEC;
}
