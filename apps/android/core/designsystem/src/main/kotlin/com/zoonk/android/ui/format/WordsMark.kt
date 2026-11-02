package com.zoonk.android.ui.format

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.buildAnnotatedString

/** Stands in a translated sentence ("Now: …") for words that keep their own spans, such as the language they're in. */
const val WORDS_MARK = "⁣"

/** [template] with [words] where its [WORDS_MARK] is. */
fun withWords(
    template: String,
    words: AnnotatedString,
) = buildAnnotatedString {
    append(template.substringBefore(WORDS_MARK))
    append(words)
    append(template.substringAfter(WORDS_MARK, ""))
}
