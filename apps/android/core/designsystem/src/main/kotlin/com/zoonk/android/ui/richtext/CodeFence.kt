package com.zoonk.android.ui.richtext

/**
 * A CommonMark fenced code block written with backticks (main's `@zoonk/utils/code-fence`). The
 * opening fence's info string can't hold a backtick, so "```x```" stays inline code. `end` is the
 * line after the closing fence; a fence that never closes runs to the text's end.
 */
data class CodeFence(
    val code: String,
    val language: String?,
    val start: Int,
    val end: Int,
    val closed: Boolean,
)

private val OPENING_FENCE = Regex(" {0,3}(`{3,})([^`]*)")
private val CLOSING_FENCE = Regex(" {0,3}(`{3,}) *")
private val WHITESPACE = Regex("\\s+")

/** A fence's name for its language: its info string's first word, in lowercase. */
internal fun readLanguage(info: String): String? =
    info
        .trim()
        .split(WHITESPACE)
        .first()
        .lowercase()
        .ifEmpty { null }

/** Code lines stay exactly as written. */
fun readCodeFence(
    lines: List<String>,
    index: Int,
): CodeFence? {
    val opening = OPENING_FENCE.matchEntire(lines.getOrNull(index) ?: return null) ?: return null
    val ticks = opening.groupValues[1].length
    val close =
        (index + 1 until lines.size).firstOrNull { at ->
            (
                CLOSING_FENCE
                    .matchEntire(lines[at])
                    ?.groupValues
                    ?.get(1)
                    ?.length ?: 0
            ) >= ticks
        }

    return CodeFence(
        code = lines.subList(index + 1, close ?: lines.size).joinToString("\n"),
        language = readLanguage(opening.groupValues[2]),
        start = index,
        end = close?.plus(1) ?: lines.size,
        closed = close != null,
    )
}

private val LINE_END = Regex("\\r?\\n")

/** A text that is one closed code block and nothing else, such as an answer option that is code. */
fun readWholeCodeFence(text: String): CodeFence? {
    val lines = text.trim().split(LINE_END)
    return readCodeFence(lines, 0)?.takeIf { it.closed && it.end == lines.size }
}

/** Every fence in order. */
fun findCodeFences(lines: List<String>): List<CodeFence> {
    val found = mutableListOf<CodeFence>()
    var index = 0

    while (index < lines.size) {
        val fence = readCodeFence(lines, index)
        if (fence == null) {
            index++
        } else {
            found += fence
            index = fence.end
        }
    }

    return found
}

/** Every line a fence covers, its fences included: the players show them as code and parse nothing in them. */
fun findCodeFenceLines(lines: List<String>): Set<Int> = findCodeFences(lines).flatMapTo(mutableSetOf()) { it.start until it.end }
