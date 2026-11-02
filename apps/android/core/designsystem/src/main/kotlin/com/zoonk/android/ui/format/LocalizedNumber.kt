package com.zoonk.android.ui.format

import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min

private val SPACES = Regex("[\\s\\u00A0\\u202F]")
private val NUMBER_CHARACTERS = Regex("^[+-]?[\\d.,]+$")
private val GROUPED_DIGITS = Regex("^[+-]?[1-9]\\d{0,2}(?:[.,]\\d{3})+$")
private val PLAIN_NUMBER = Regex("^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)$")
private const val EXACT_MIN_FRACTION_DIGITS = 2

/**
 * Main's `parseLocalizedNumber`: a number typed with either separator, where a lone separator is
 * a decimal point unless it groups thousands the locale's way ("1,000" in English, "1.000" in
 * Portuguese; "0,125" is always a decimal). With both, the last is the decimal point in any
 * language, since a learner may type their region's notation. Null for anything else.
 */
fun parseLocalizedNumber(
    text: String,
    locale: Locale,
): Double? {
    val cleaned = text.replace(SPACES, "").replace('−', '-')

    if (!NUMBER_CHARACTERS.matches(cleaned)) return null

    val normalized = normalizeSeparators(cleaned, decimalSeparator(locale))

    if (!PLAIN_NUMBER.matches(normalized)) return null

    return normalized.toDoubleOrNull()?.takeIf { it.isFinite() }
}

private fun decimalSeparator(locale: Locale): Char = DecimalFormatSymbols.getInstance(locale).decimalSeparator

private fun normalizeSeparators(
    text: String,
    decimal: Char,
): String {
    val hasDot = '.' in text
    val hasComma = ',' in text

    return when {
        hasDot && hasComma -> {
            val (point, grouping) = if (text.lastIndexOf('.') > text.lastIndexOf(',')) '.' to ',' else ',' to '.'
            text.replace(grouping.toString(), "").replace(point, '.')
        }

        hasComma -> {
            normalizeOneSeparator(text, ',', decimal)
        }

        hasDot -> {
            normalizeOneSeparator(text, '.', decimal)
        }

        else -> {
            text
        }
    }
}

private fun normalizeOneSeparator(
    text: String,
    separator: Char,
    decimal: Char,
): String {
    val groupsThousands = decimal != separator && GROUPED_DIGITS.matches(text)
    return if (groupsThousands) text.replace(separator.toString(), "") else text.replaceFirst(separator, '.')
}

/**
 * Main's `exactFractionDigitsFor`: enough digits that a wrong answer never rounds to read the
 * same as the expected one, given the check's [allowed] difference.
 */
fun exactFractionDigitsFor(
    expected: Double,
    allowed: Double,
    value: Double = expected,
): Int {
    if (allowed == 0.0) return MAX_FRACTION_DIGITS

    val difference = abs(value - expected)
    val differenceDigits = if (difference > allowed) digitsForResolution(difference) + 1 else 0

    return min(
        MAX_FRACTION_DIGITS,
        maxOf(
            EXACT_MIN_FRACTION_DIGITS,
            fractionDigitsFor(expected),
            fractionDigitsFor(value),
            digitsForResolution(allowed),
            differenceDigits,
        ),
    )
}

private fun digitsForResolution(resolution: Double): Int = max(0, ceil(-log10(resolution)).toInt())
