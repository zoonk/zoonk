package com.zoonk.android.feature.activities.code

import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf16FieldsMistakesInner as CodeRunnerMistake

private val TRAILING_LINE_SPACE = Regex("""[\t ]+(?=[\n\r  ]|\z)""")
private val EDGE_SPACE = Regex("""^[$SPACE_CHARS]+|[$SPACE_CHARS]+\z""")

/** Core's `normalizeProgramOutput`: no spaces at line ends, nor blank lines around the output. */
internal fun normalizeProgramOutput(output: String): String = output.replace(TRAILING_LINE_SPACE, "").jsTrim()

/** JavaScript's `trim`, whose whitespace isn't Kotlin's. */
internal fun String.jsTrim(): String = replace(EDGE_SPACE, "")

internal fun sameOutput(
    first: String,
    second: String,
): Boolean = normalizeProgramOutput(first) == normalizeProgramOutput(second)

internal fun mistakeFor(
    output: String,
    mistakes: List<CodeRunnerMistake>,
): CodeRunnerMistake? = mistakes.firstOrNull { sameOutput(it.output, output) }

/** [edits] by line number, from 1. */
internal fun programWithEdits(
    starterCode: String,
    edits: Map<Int, String>,
): String =
    starterCode
        .split("\n")
        .mapIndexed { index, line -> edits[index + 1] ?: line }
        .joinToString("\n")
