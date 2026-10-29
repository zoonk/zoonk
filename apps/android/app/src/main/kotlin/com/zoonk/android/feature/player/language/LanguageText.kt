package com.zoonk.android.feature.player.language

import java.text.BreakIterator
import java.text.Normalizer

// Ports of main's text rules for language screens (`@zoonk/utils/string`,
// `packages/player/src/components/_utils`), so answers and hints read the same on both.

private val QUOTE_PAIRS = mapOf('"' to '"', '\'' to '\'', '‘' to '’', '“' to '”')
private val NESTED_QUOTE = Regex("""(?<![\p{L}\p{N}])['"‘’“”]|['"‘’“”](?![\p{L}\p{N}])""")

/** A whole sentence in quotes loses them, unless quotes inside it would then stand alone. */
fun stripWrappingQuotes(value: String): String {
    val trimmed = value.trim()
    val closer = trimmed.firstOrNull()?.let(QUOTE_PAIRS::get) ?: return value
    if (trimmed.length < 2 || trimmed.last() != closer) return value
    val inner = trimmed.substring(1, trimmed.length - 1)
    return if (NESTED_QUOTE.containsMatchIn(inner)) value else inner.trim()
}

private val SPACE_BEFORE_PUNCTUATION = Regex("""(?<!\s)\s+([!?.,;:。、！？؟])""")
private val NOT_LETTER_NUMBER_OR_SPACE = Regex("""[^\p{L}\p{N}\s]""")
private val COMBINING_MARKS = Regex("[̀-ͯ]")
private val SPACES = Regex("""\s+""")

fun normalizePunctuation(text: String): String = text.replace(SPACE_BEFORE_PUNCTUATION, "$1")

fun stripPunctuation(text: String): String = text.replace(NOT_LETTER_NUMBER_OR_SPACE, "")

fun normalizeString(text: String): String =
    Normalizer
        .normalize(text, Normalizer.Form.NFD)
        .replace(COMBINING_MARKS, "")
        .lowercase()
        .replace(SPACES, " ")
        .trim()

/**
 * A sentence's words, punctuation kept on the word it follows. Text without spaces (Japanese,
 * Chinese, Thai) splits at word boundaries, with connector-linked runs ("gato-123") kept whole.
 */
fun segmentWords(text: String): List<String> {
    val normalized = normalizePunctuation(text)
    if (' ' in normalized) return normalized.split(' ').filter(String::isNotEmpty)
    return segmentNonSpaceText(normalized)
}

private fun segmentNonSpaceText(text: String): List<String> {
    val tokens = mutableListOf<String>()
    var prefix = ""
    val words = BreakIterator.getWordInstance().apply { setText(text) }
    var start = words.first()
    var end = words.next()
    while (end != BreakIterator.DONE) {
        val segment = text.substring(start, end)
        val last = tokens.lastOrNull()
        when {
            segment.isWordLike() && last != null && last.last().isConnector() -> tokens[tokens.lastIndex] = last + segment
            segment.isWordLike() -> tokens += prefix + segment.also { prefix = "" }
            last == null -> prefix += segment
            else -> tokens[tokens.lastIndex] = last + segment
        }
        start = end
        end = words.next()
    }
    return tokens
}

private fun String.isWordLike() = any(Char::isLetterOrDigit)

private fun Char.isConnector() = this in "-'’‐‑‒–"

/** The words a reading or listening answer must be built from; blank text has none. */
fun acceptedWords(text: String): List<String> = segmentWords(text)

private val REGEX_SPECIAL = Regex("""[.*+?^${'$'}{}()|\[\]\\]""")

/** The sentence's romanization with the answer's part hidden, so it doesn't give the blank away. */
fun templateRomanization(
    answer: String?,
    sentence: String?,
): String? {
    if (sentence == null) return null
    if (answer.isNullOrEmpty()) return sentence
    val escaped = answer.replace(REGEX_SPECIAL) { "\\" + it.value }
    val pattern = Regex("""(?<=\s|^|["'«「])$escaped(?=\s|[.,!?;:)"'»」]|$)""", RegexOption.IGNORE_CASE)
    return pattern.replaceFirst(sentence, "____")
}

/** A word of a reading prompt, with the target-language word it stands for when one is known. */
data class PromptWordHint(
    val word: String,
    val translation: String?,
)

/**
 * Each prompt word is paired with the sentence word whose translation it is; the words left over
 * pair up in order, so every hinted word shows one translation.
 */
fun readingPromptHints(
    prompt: String,
    sentenceWordOptions: List<WordBankOption>,
): List<PromptWordHint> {
    val words = segmentWords(prompt)
    val targets =
        sentenceWordOptions.mapNotNull { option ->
            val key = promptKey(option.translation)
            val translation = stripEdgePunctuation(option.word)
            if (key.isEmpty() || translation.isEmpty()) null else key to translation
        }
    val used = mutableSetOf<Int>()
    val direct =
        words.map { word ->
            val key = promptKey(word)
            targets.indices.firstOrNull { it !in used && targets[it].first == key }?.also(used::add)
        }
    val leftoverTargets = targets.indices.filter { it !in used }
    val leftoverWords = direct.indices.filter { direct[it] == null }
    val fallback = leftoverWords.zip(leftoverTargets).toMap()
    return words.mapIndexed { index, word ->
        PromptWordHint(word, (direct[index] ?: fallback[index])?.let { targets[it].second })
    }
}

private val EDGE_PUNCTUATION = Regex("""^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$""")

private fun stripEdgePunctuation(word: String) = word.replace(EDGE_PUNCTUATION, "")

private fun promptKey(word: String?) = normalizeString(stripPunctuation(word.orEmpty()))
