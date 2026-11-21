package com.zoonk.android.ui.code

// Main's `code-languages.ts`, with JavaScript's meaning spelled out: `\s`, `\S`, `\d`, `\w`, `.` and `$` differ
// between JavaScript, the JVM and Android's ICU engine.
const val SPACE_CHARS = """\t\n\u000B\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF"""
private const val ANY_BUT_LINE_END = """[^\n\r\u2028\u2029]"""
private const val END = """\z"""

enum class CodeTokenKind { Builtin, Comment, Keyword, Number, Plain, String }

/** A `Word` match is looked up in the language's keywords and built-ins; the other kinds color what they match. */
internal enum class RuleKind { Comment, Keyword, Number, String, Word }

internal class TokenRule(
    val kind: RuleKind,
    val pattern: Regex,
)

internal class CodeLanguageSpec(
    val keywords: Set<String>,
    val builtins: Set<String>,
    val ignoreCase: Boolean,
    val rules: List<TokenRule>,
)

private fun rule(
    kind: RuleKind,
    pattern: String,
    ignoreCase: Boolean = false,
) = TokenRule(kind, if (ignoreCase) Regex(pattern, RegexOption.IGNORE_CASE) else Regex(pattern))

private const val NUMBER = """(?:0x[0-9a-f]+|[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)"""
private const val WORD = """[${'$'}\p{L}_][\p{L}\p{N}_${'$'}]*"""
private const val SLASH_COMMENT = """//[^\n]*|/\*[\s\S]*?(?:\*/|$END)"""

/** A string the learner hasn't closed yet still colors to the line's end, as an editor does. */
private const val QUOTED = """"(?:\\$ANY_BUT_LINE_END|[^"\\\n])*"?|'(?:\\$ANY_BUT_LINE_END|[^'\\\n])*'?"""

private const val JAVASCRIPT_KEYWORDS =
    "async await break case catch class const continue default delete do else export extends false finally for from function if " +
        "import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield"

private const val JAVASCRIPT_BUILTINS =
    "Array Boolean Date Error JSON Map Math Number Object Promise Set String console document fetch parseFloat parseInt " +
        "setInterval setTimeout window"

private val JAVASCRIPT_RULES =
    listOf(
        rule(RuleKind.Comment, SLASH_COMMENT),
        rule(RuleKind.String, """$QUOTED|`(?:\\$ANY_BUT_LINE_END|[^`\\])*`?"""),
        rule(RuleKind.Number, NUMBER, ignoreCase = true),
        rule(RuleKind.Word, WORD),
    )

/** C-like languages with a string in either quote (a `char` in Java and C). */
private val C_LIKE_RULES =
    listOf(
        rule(RuleKind.Comment, SLASH_COMMENT),
        rule(RuleKind.String, QUOTED),
        rule(RuleKind.Number, NUMBER, ignoreCase = true),
        rule(RuleKind.Word, WORD),
    )

private class Language(
    /** What writers put after a fence's backticks for it, in lowercase. */
    val names: List<String>,
    val rules: List<TokenRule>,
    val keywords: String = "",
    val builtins: String = "",
    val ignoreCase: Boolean = false,
)

private val LANGUAGES =
    listOf(
        Language(
            names = listOf("javascript", "js", "jsx", "mjs", "cjs", "node"),
            rules = JAVASCRIPT_RULES,
            keywords = JAVASCRIPT_KEYWORDS,
            builtins = JAVASCRIPT_BUILTINS,
        ),
        Language(
            names = listOf("typescript", "ts", "tsx", "mts", "cts"),
            rules = JAVASCRIPT_RULES,
            keywords =
                "$JAVASCRIPT_KEYWORDS abstract as declare enum implements interface keyof namespace private protected public readonly " +
                    "satisfies type",
            builtins = "$JAVASCRIPT_BUILTINS Partial Readonly Record any boolean never number object string unknown",
        ),
        Language(
            names = listOf("python", "py", "python3", "py3"),
            rules =
                listOf(
                    rule(RuleKind.Comment, """#[^\n]*"""),
                    rule(
                        RuleKind.String,
                        """[bfr]{0,2}(?:""${'"'}[\s\S]*?(?:""${'"'}|$END)|'''[\s\S]*?(?:'''|$END)|$QUOTED)""",
                        ignoreCase = true,
                    ),
                    rule(RuleKind.Number, NUMBER, ignoreCase = true),
                    rule(RuleKind.Word, WORD),
                ),
            keywords =
                "False None True and as assert async await break class continue def del elif else except finally for from global if " +
                    "import in is lambda nonlocal not or pass raise return try while with yield",
            builtins =
                "abs bool dict enumerate float input int len list map max min open print range reversed round self set sorted str sum " +
                    "tuple type zip",
        ),
        Language(
            names = listOf("sql", "postgres", "postgresql", "mysql", "sqlite", "mariadb"),
            rules =
                listOf(
                    rule(RuleKind.Comment, """--[^\n]*|/\*[\s\S]*?(?:\*/|$END)"""),
                    rule(RuleKind.String, """'(?:''|[^'])*'?"""),
                    rule(RuleKind.Number, NUMBER, ignoreCase = true),
                    rule(RuleKind.Word, WORD),
                ),
            keywords =
                "all alter and as asc between by case create cross delete desc distinct drop else end exists false foreign from full " +
                    "group having in index inner insert into is join key left like limit not null offset on or order outer primary " +
                    "references right select set table then true union update values view when where with",
            builtins = "avg coalesce count length lower max min now round substr sum upper",
            ignoreCase = true,
        ),
        Language(
            names = listOf("java"),
            rules = C_LIKE_RULES,
            keywords =
                "abstract boolean break byte case catch char class continue default do double else enum extends false final finally " +
                    "float for if implements import instanceof int interface long new null package private protected public return " +
                    "short static super switch this throw throws true try var void while",
            builtins = "ArrayList HashMap Integer List Map Math Object Scanner String System",
        ),
        // C and C++ in one: a C program rarely names anything after a C++ keyword.
        Language(
            names = listOf("c", "h", "cpp", "c++", "cc", "cxx", "hpp"),
            rules = listOf(C_LIKE_RULES.first(), rule(RuleKind.Keyword, """#[ \t]*[a-z]+""")) + C_LIKE_RULES.drop(1),
            keywords =
                "auto bool break case catch char class const continue default delete do double else enum extern false float for if " +
                    "int long namespace new nullptr private protected public return short signed sizeof static struct switch template " +
                    "this throw true try typedef union unsigned using virtual void while",
            builtins = "NULL cin cout endl free malloc printf puts scanf std strlen",
        ),
        Language(
            names = listOf("html", "htm", "xml", "svg"),
            rules =
                listOf(
                    rule(RuleKind.Comment, """<!--[\s\S]*?(?:-->|$END)"""),
                    rule(RuleKind.Keyword, """(?<=</?)[A-Za-z][A-Za-z0-9_:.-]*"""),
                    rule(RuleKind.String, """(?<==)(?:"[^"\n]*"?|'[^'\n]*'?)"""),
                    rule(RuleKind.Word, WORD),
                ),
        ),
        Language(
            names = listOf("css", "scss", "less"),
            rules =
                listOf(
                    rule(RuleKind.Comment, """/\*[\s\S]*?(?:\*/|$END)"""),
                    rule(RuleKind.String, QUOTED),
                    rule(RuleKind.Keyword, """@[A-Za-z0-9_-]+"""),
                    rule(RuleKind.Number, """-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:%|[a-z]+)?""", ignoreCase = true),
                    rule(RuleKind.Word, """[\p{L}_-][\p{L}\p{N}_-]*"""),
                ),
        ),
        // Program output and other text shown as written, with nothing colored.
        Language(names = listOf("text", "txt", "plaintext", "plain", "output", "console", "log"), rules = emptyList()),
    )

/**
 * A language we don't know, or a fence with none: only what reads the same in most languages. A
 * comment needs its marker at a word's start and a space after `#` or `--` (`#include`, `x--` and
 * a URL's `//` stay plain), and a quote right after a letter is an apostrophe, not a string.
 */
private val UNKNOWN =
    Language(
        names = emptyList(),
        rules =
            listOf(
                rule(RuleKind.Comment, """(?<!:)//[^\n]*|/\*[\s\S]*?(?:\*/|$END)|(?<![^$SPACE_CHARS])(?:#|--)(?=[ \t])[^\n]*"""),
                rule(
                    RuleKind.String,
                    """(?<![\p{L}\p{N}])(?:"(?:\\$ANY_BUT_LINE_END|[^"\\\n])*"|'(?:\\$ANY_BUT_LINE_END|[^'\\\n])*')""",
                ),
                rule(RuleKind.Number, NUMBER, ignoreCase = true),
                rule(RuleKind.Word, WORD),
            ),
    )

private fun words(list: String): Set<String> = list.split(" ").filter { it.isNotEmpty() }.toSet()

private fun Language.spec() = CodeLanguageSpec(words(keywords), words(builtins), ignoreCase, rules)

private val BY_NAME = LANGUAGES.flatMap { language -> language.spec().let { spec -> language.names.map { it to spec } } }.toMap()

private val UNKNOWN_SPEC = UNKNOWN.spec()

internal fun findCodeLanguage(name: String?): CodeLanguageSpec = BY_NAME[name?.lowercase()] ?: UNKNOWN_SPEC
