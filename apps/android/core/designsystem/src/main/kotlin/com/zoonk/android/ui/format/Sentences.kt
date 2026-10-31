package com.zoonk.android.ui.format

/** Japanese and Chinese never put a space between sentences: their full-width stops carry their own spacing. */
private val FULL_WIDTH_STOPS = setOf('。', '！', '？')

fun spaceAfterSentence(sentence: String): String = if (sentence.lastOrNull() in FULL_WIDTH_STOPS) "" else " "

fun Iterable<String>.joinSentences(): String = reduceOrNull { text, sentence -> text + spaceAfterSentence(text) + sentence }.orEmpty()

fun joinSentences(vararg sentences: String): String = sentences.asList().joinSentences()
