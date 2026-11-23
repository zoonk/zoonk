package com.zoonk.android.ui.code

data class CodeToken(
    val kind: CodeTokenKind,
    val text: String,
)

fun codeLineText(tokens: List<CodeToken>): String = tokens.joinToString("") { it.text }

private val SPACE = Regex("[$SPACE_CHARS]+")

private fun Regex.textAt(
    code: String,
    index: Int,
): String? = matchAt(code, index)?.value?.ifEmpty { null }

/** A name after a dot is a property (`console.log`, `user.type`), never a keyword. */
private fun wordKind(
    code: String,
    index: Int,
    word: String,
    language: CodeLanguageSpec,
): CodeTokenKind {
    val name = if (language.ignoreCase) word.lowercase() else word

    return when {
        code.getOrNull(index - 1) == '.' -> CodeTokenKind.Plain
        name in language.keywords -> CodeTokenKind.Keyword
        name in language.builtins -> CodeTokenKind.Builtin
        else -> CodeTokenKind.Plain
    }
}

private fun RuleKind.tokenKind(): CodeTokenKind =
    when (this) {
        RuleKind.Comment -> CodeTokenKind.Comment
        RuleKind.Keyword -> CodeTokenKind.Keyword
        RuleKind.Number -> CodeTokenKind.Number
        RuleKind.String -> CodeTokenKind.String
        RuleKind.Word -> CodeTokenKind.Plain
    }

private fun tokenAt(
    code: String,
    index: Int,
    language: CodeLanguageSpec,
): CodeToken {
    SPACE.textAt(code, index)?.let { return CodeToken(CodeTokenKind.Plain, it) }

    for (rule in language.rules) {
        val text = rule.pattern.textAt(code, index) ?: continue
        val kind = if (rule.kind == RuleKind.Word) wordKind(code, index, text, language) else rule.kind.tokenKind()
        return CodeToken(kind, text)
    }

    return CodeToken(CodeTokenKind.Plain, code.substring(index, index + 1))
}

/** Adjacent tokens of one kind merge, so a line has as few runs as its colors need. */
private fun tokenize(
    code: String,
    language: CodeLanguageSpec,
): List<CodeToken> {
    val tokens = mutableListOf<CodeToken>()
    var index = 0

    while (index < code.length) {
        val token = tokenAt(code, index, language)
        val last = tokens.lastOrNull()
        if (last?.kind == token.kind) tokens[tokens.lastIndex] = last.copy(text = last.text + token.text) else tokens += token
        index += token.text.length
    }

    return tokens
}

/**
 * The program's lines, each as its colored runs, with every character kept as written (main's
 * `highlightCode`). It scans tokens without parsing the language, which is enough for the short
 * programs lessons show; a comment or string that spans lines colors each of them. `language` is a
 * fence's name for it, or null when it has none.
 */
fun highlightCode(
    code: String,
    language: String?,
): List<List<CodeToken>> {
    val lines = mutableListOf(mutableListOf<CodeToken>())

    tokenize(code, findCodeLanguage(language)).forEach { token ->
        token.text.split("\n").forEachIndexed { part, text ->
            if (part > 0) lines += mutableListOf<CodeToken>()
            if (text.isNotEmpty()) lines.last() += CodeToken(token.kind, text)
        }
    }

    return lines
}
