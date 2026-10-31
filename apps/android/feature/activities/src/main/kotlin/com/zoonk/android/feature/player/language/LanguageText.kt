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

// JavaScript's `\s` also takes the ideographic space Japanese writes between words.
private val ANY_SPACES = Regex("""[\s\p{Z}]+""")

private val JAPANESE_SCRIPTS =
    setOf(Character.UnicodeScript.HAN, Character.UnicodeScript.HIRAGANA, Character.UnicodeScript.KATAKANA)

private enum class PhraseScript { Hiragana, Katakana, Other }

private fun Int.isLetterOrNumber() =
    Character.isLetter(this) ||
        Character.getType(this).toByte() in
        setOf(Character.DECIMAL_DIGIT_NUMBER, Character.LETTER_NUMBER, Character.OTHER_NUMBER)

private fun Int.isOpeningPunctuation() =
    Character.getType(this).toByte() in setOf(Character.START_PUNCTUATION, Character.INITIAL_QUOTE_PUNCTUATION)

private fun phraseScript(codePoint: Int): PhraseScript? =
    when {
        Character.getType(codePoint).toByte() == Character.MODIFIER_LETTER || !codePoint.isLetterOrNumber() -> null
        Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HIRAGANA -> PhraseScript.Hiragana
        Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.KATAKANA -> PhraseScript.Katakana
        else -> PhraseScript.Other
    }

/** Core's `splitJapanesePhrases`: a kanji, katakana or Latin word with the kana after it ("駅まで"). */
private fun splitJapanesePhrases(text: String): List<String> {
    val phrases = mutableListOf<String>()
    var previous: PhraseScript? = null
    text.codePoints().forEach { codePoint ->
        val char = String(Character.toChars(codePoint))
        val script = phraseScript(codePoint)
        val opens = codePoint.isOpeningPunctuation()
        val startsWord = script != null && script != PhraseScript.Hiragana && previous != script
        if (phrases.isEmpty() || opens || (startsWord && previous != null)) {
            phrases += char
        } else {
            phrases[phrases.lastIndex] += char
        }
        previous = if (opens) null else script ?: previous
    }
    return phrases
}

/** Core's `segmentLearnerWords`: Japanese, the one app language without spaces, splits into phrases. */
fun segmentLearnerWords(text: String): List<String> {
    val normalized = normalizePunctuation(text)
    val isJapanese = normalized.codePoints().anyMatch { Character.UnicodeScript.of(it) in JAPANESE_SCRIPTS }
    if (!isJapanese) return segmentWords(normalized)
    return normalized.split(ANY_SPACES).filter(String::isNotEmpty).flatMap(::splitJapanesePhrases)
}

private val UNSPACED_SCRIPTS =
    JAPANESE_SCRIPTS +
        setOf(
            Character.UnicodeScript.THAI,
            Character.UnicodeScript.LAO,
            Character.UnicodeScript.KHMER,
            Character.UnicodeScript.MYANMAR,
        )

/** Core's `countWords`: text without spaces (Japanese, Chinese, Thai) counts the words a dictionary finds. */
fun countWords(text: String): Int =
    text.split(ANY_SPACES).sumOf { piece ->
        val unspaced = piece.codePoints().anyMatch { Character.UnicodeScript.of(it) in UNSPACED_SCRIPTS }
        val words = if (unspaced) segmentNonSpaceText(piece) else listOf(piece)
        words.count { word -> word.codePoints().anyMatch { it.isLetterOrNumber() } }
    }

/**
 * The words a reading or listening answer must be built from; blank text has none. A listening
 * builds the translation, in the learner's own language.
 */
internal fun acceptedWords(
    text: String,
    kind: ArrangeKind,
): List<String> =
    when (kind) {
        ArrangeKind.Reading -> segmentWords(text)
        ArrangeKind.Listening -> segmentLearnerWords(text)
    }

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
