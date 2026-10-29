package com.zoonk.android.feature.activities.code

enum class CodeTokenKind { Builtin, Comment, Keyword, Number, Plain, String }

data class CodeToken(
    val kind: CodeTokenKind,
    val text: String,
)

private val JAVASCRIPT_KEYWORDS =
    setOf(
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
    )

private val JAVASCRIPT_BUILTINS =
    setOf(
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
    )

private val PYTHON_KEYWORDS =
    setOf(
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
    )

private val PYTHON_BUILTINS =
    setOf(
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
    )

private val SQL_KEYWORDS =
    setOf(
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
    )

private val SQL_BUILTINS =
    setOf("avg", "coalesce", "count", "length", "lower", "max", "min", "round", "substr", "sum", "upper")

// Main's patterns (`highlight-code.ts`) with JavaScript's meaning spelled out, because `\s`, `\w`, `.` and `$`
// differ between JavaScript, the JVM and Android's ICU engine.
private const val SPACE_CHARS = """\t\n\u000B\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF"""
private const val WORD_CHARS = "A-Za-z0-9_"
private const val ANY_BUT_LINE_END = """[^\n\r\u2028\u2029]"""

private val SPACE = Regex("[$SPACE_CHARS]+")
private val OTHER = Regex("[^$SPACE_CHARS$WORD_CHARS\$\"'`#/\\-]+|[\\s\\S]")
private val NUMBER = Regex("""0[xX][0-9a-fA-F]+|[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?""")
private val BLOCK_COMMENT = """/\*[\s\S]*?(?:\*/|\z)"""
private val QUOTED = """["](?:\\$ANY_BUT_LINE_END|[^"\\\n])*["]?|'(?:\\$ANY_BUT_LINE_END|[^'\\\n])*'?"""

private enum class RuleKind { Comment, String, Number, Word }

private class TokenRule(
    val kind: RuleKind,
    val pattern: Regex,
)

private val RULES =
    mapOf(
        CodeLanguage.JavaScript to
            listOf(
                TokenRule(RuleKind.Comment, Regex("""//[^\n]*|$BLOCK_COMMENT""")),
                TokenRule(RuleKind.String, Regex("""$QUOTED|`(?:\\$ANY_BUT_LINE_END|[^`\\])*`?""")),
                TokenRule(RuleKind.Number, NUMBER),
                TokenRule(RuleKind.Word, Regex("[\$A-Z_a-z][$WORD_CHARS\$]*")),
            ),
        CodeLanguage.Python to
            listOf(
                TokenRule(RuleKind.Comment, Regex("#[^\\n]*")),
                TokenRule(
                    RuleKind.String,
                    Regex("""[bfrBFR]{0,2}(?:"{3}[\s\S]*?(?:"{3}|\z)|'{3}[\s\S]*?(?:'{3}|\z)|$QUOTED)"""),
                ),
                TokenRule(RuleKind.Number, NUMBER),
                TokenRule(RuleKind.Word, Regex("[A-Z_a-z][$WORD_CHARS]*")),
            ),
        CodeLanguage.Sql to
            listOf(
                TokenRule(RuleKind.Comment, Regex("""--[^\n]*|$BLOCK_COMMENT""")),
                TokenRule(RuleKind.String, Regex("'(?:''|[^'])*'?")),
                TokenRule(RuleKind.Number, NUMBER),
                TokenRule(RuleKind.Word, Regex("[A-Z_a-z][$WORD_CHARS]*")),
            ),
    )

private fun wordKind(
    word: String,
    language: CodeLanguage,
): CodeTokenKind {
    val (keywords, builtins, key) =
        when (language) {
            CodeLanguage.JavaScript -> Triple(JAVASCRIPT_KEYWORDS, JAVASCRIPT_BUILTINS, word)
            CodeLanguage.Python -> Triple(PYTHON_KEYWORDS, PYTHON_BUILTINS, word)
            CodeLanguage.Sql -> Triple(SQL_KEYWORDS, SQL_BUILTINS, word.lowercase())
        }

    return when (key) {
        in keywords -> CodeTokenKind.Keyword
        in builtins -> CodeTokenKind.Builtin
        else -> CodeTokenKind.Plain
    }
}

private fun Regex.textAt(
    code: String,
    index: Int,
): String? = matchAt(code, index)?.value?.ifEmpty { null }

private fun tokenAt(
    code: String,
    index: Int,
    language: CodeLanguage,
): CodeToken {
    SPACE.textAt(code, index)?.let { return CodeToken(CodeTokenKind.Plain, it) }

    for (rule in RULES.getValue(language)) {
        val text = rule.pattern.textAt(code, index) ?: continue
        val kind =
            when (rule.kind) {
                RuleKind.Comment -> CodeTokenKind.Comment
                RuleKind.String -> CodeTokenKind.String
                RuleKind.Number -> CodeTokenKind.Number
                RuleKind.Word -> wordKind(text, language)
            }
        return CodeToken(kind, text)
    }

    return CodeToken(CodeTokenKind.Plain, OTHER.textAt(code, index) ?: code.substring(index, index + 1))
}

/** The code's tokens, one list per line; a token spanning lines, like a docstring, is split at each line break. */
fun highlightCode(
    code: String,
    language: CodeLanguage,
): List<List<CodeToken>> {
    val lines = mutableListOf(mutableListOf<CodeToken>())
    var index = 0

    while (index < code.length) {
        val token = tokenAt(code, index, language)
        token.text.split("\n").forEachIndexed { part, text ->
            if (part > 0) lines += mutableListOf<CodeToken>()
            if (text.isNotEmpty()) lines.last() += CodeToken(token.kind, text)
        }
        index += token.text.length
    }

    return lines
}
