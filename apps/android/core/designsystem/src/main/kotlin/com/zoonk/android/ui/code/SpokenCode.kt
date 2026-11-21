package com.zoonk.android.ui.code

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalResources
import com.zoonk.android.R

data class IndentRun(
    val count: Int,
    val tab: Boolean,
)

/** A line of code as a screen reader says it: its indentation, then its code without it (main's `readCodeLine`). */
data class SpokenCodeLine(
    val code: String,
    val indent: List<IndentRun>,
)

private val RUNS = Regex(" +|\t+")

fun readCodeLine(line: String): SpokenCodeLine {
    val indentation = line.takeWhile { it == ' ' || it == '\t' }
    val code = line.drop(indentation.length).trimEnd()
    val indent = RUNS.findAll(indentation).map { IndentRun(it.value.length, it.value.first() == '\t') }.toList()
    return SpokenCodeLine(code, if (code.isEmpty()) emptyList() else indent)
}

/**
 * Code in words TalkBack keeps apart (main's `useSpokenCode`): a line's number and its indentation,
 * which the eye reads from where its code starts. Without them, a program whose `print` is indented
 * under its `for` and one where it isn't read the same.
 */
@Immutable
class SpokenCode internal constructor(
    private val resources: Resources,
) {
    private fun indentWords(indent: List<IndentRun>): String =
        indent.joinToString(", ") { (count, tab) ->
            resources.getQuantityString(if (tab) R.plurals.richtext_code_tabs else R.plurals.richtext_code_spaces, count, count)
        }

    fun line(
        text: String,
        number: Int,
    ): String {
        val (code, indent) = readCodeLine(text)
        return when {
            code.isEmpty() -> resources.getString(R.string.richtext_code_line_blank, number)
            indent.isEmpty() -> resources.getString(R.string.richtext_code_line, number, code)
            else -> resources.getString(R.string.richtext_code_line_indented, number, indentWords(indent), code)
        }
    }

    /** Code the learner presses, such as an answer option: one line reads as written. */
    fun snippet(code: String): String {
        val lines = code.split(Regex("\r?\n"))
        if (lines.size > 1) return lines.mapIndexed { index, text -> line(text, index + 1) }.joinToString(" ")
        val (written, indent) = readCodeLine(lines.first())
        return if (indent.isEmpty()) written else resources.getString(R.string.richtext_code_indented, indentWords(indent), written)
    }
}

@Composable
fun rememberSpokenCode(): SpokenCode {
    val resources = LocalResources.current
    return remember(resources) { SpokenCode(resources) }
}
