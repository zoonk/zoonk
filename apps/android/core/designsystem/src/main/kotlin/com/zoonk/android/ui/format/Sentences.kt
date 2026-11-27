package com.zoonk.android.ui.format

/** Japanese and Chinese never put a space between sentences: their full-width stops carry their own spacing. */
private val FULL_WIDTH_STOPS = setOf('。', '！', '？')

fun spaceAfterSentence(sentence: String): String = if (sentence.lastOrNull() in FULL_WIDTH_STOPS) "" else " "

fun Iterable<String>.joinSentences(): String = reduceOrNull { text, sentence -> text + spaceAfterSentence(text) + sentence }.orEmpty()

fun joinSentences(vararg sentences: String): String = sentences.asList().joinSentences()

private val SENTENCE_STOPS = setOf('.', '!', '?', '…', '。', '！', '？')

/**
 * Puts [text] where [slot] stands in a translated line. A text that ends a sentence itself takes the place of the line's
 * own stop right after it, so "…di fronte." never reads "…di fronte..".
 */
fun String.fillSlot(
    slot: String,
    text: String,
): String {
    val at = indexOf(slot)
    if (at < 0) return this
    val rest = substring(at + slot.length)
    val after = if (text.lastOrNull() in SENTENCE_STOPS && rest.firstOrNull() in SENTENCE_STOPS) rest.drop(1) else rest
    return substring(0, at) + text + after
}
