package com.zoonk.android.feature.activities

/** Main's `pattern-cells.ts`: where a form's stem ends and its ending begins. */
fun commonStem(words: List<String>): String {
    val first = words.firstOrNull().orEmpty()
    val rest = words.drop(1)
    val length = first.indices.firstOrNull { index -> rest.any { it.getOrNull(index) != first[index] } }
    return if (length == null) first else first.take(length)
}

data class FormParts(
    val stem: String,
    val ending: String,
)

fun splitForm(
    form: String,
    stem: String,
): FormParts =
    if (stem.isNotEmpty() && form.startsWith(stem) &&
        form.length > stem.length
    ) {
        FormParts(stem, form.drop(stem.length))
    } else {
        FormParts(form, "")
    }

/** Core's `patternEnding`: the longest choice the answer ends with. */
fun patternEnding(
    choices: List<String>,
    answer: String,
): String? = choices.filter { answer.endsWith(it) }.maxByOrNull { it.length }

fun blankStem(
    choices: List<String>,
    answer: String,
): String = answer.dropLast(patternEnding(choices, answer)?.length ?: 0)

/** The next blank still open after [current], wrapping around. */
fun nextOpenBlank(
    blanks: List<Int>,
    current: Int?,
    filled: Map<String, String>,
): Int? {
    val start = if (current == null) 0 else blanks.indexOf(current) + 1
    return (blanks.drop(start) + blanks.take(start)).firstOrNull { "$it" !in filled }
}
