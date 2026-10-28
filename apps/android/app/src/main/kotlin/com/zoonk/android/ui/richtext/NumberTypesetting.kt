package com.zoonk.android.ui.richtext

import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

private const val NBSP = "\u00A0"

/**
 * A whole number of five digits or more written without grouping ("350000"), not part of a
 * decimal, a code, a date or a word, and not starting with 0 (a postal code or an ID).
 */
private val LONG_NUMBER = Regex("(?<![0-9.,\\p{L}/-])[1-9][0-9]{4,}(?![0-9\\p{L}/-]|[.,][0-9])")

/** Units lessons write after a number, in their own case ("A" is amperes, "a" is a word). */
private val UNITS =
    listOf(
        "%",
        "°C",
        "°F",
        "A",
        "B",
        "GB",
        "GHz",
        "Hz",
        "J",
        "K",
        "KB",
        "L",
        "MB",
        "MHz",
        "N",
        "Pa",
        "TB",
        "V",
        "W",
        "cal",
        "cm",
        "cm²",
        "cm³",
        "g",
        "h",
        "ha",
        "kHz",
        "kJ",
        "kW",
        "kWh",
        "kcal",
        "kg",
        "km",
        "km/h",
        "km²",
        "l",
        "m",
        "m/s",
        "mA",
        "mL",
        "mg",
        "min",
        "ml",
        "mm",
        "mol",
        "ms",
        "m²",
        "m³",
        "nm",
        "rpm",
        "s",
        "t",
        "µm",
        "Ω",
        "kΩ",
    )

private val NUMBER_THEN_UNIT =
    Regex(
        "(?<=[0-9]) (?=(?:${UNITS.sortedByDescending { it.length }.joinToString("|") { Regex.escape(it) }})(?![\\p{L}0-9]))",
    )

private val CURRENCY_THEN_NUMBER = Regex("(\\p{Lu}{0,2}\\p{Sc}) (?=[0-9])")

private val CURRENCY_SYMBOLS =
    mapOf(
        "$" to "USD",
        "A$" to "AUD",
        "C$" to "CAD",
        "R$" to "BRL",
        "US$" to "USD",
        "£" to "GBP",
        "¥" to "JPY",
        "€" to "EUR",
        "₹" to "INR",
    )

/**
 * The gap the learner's money format puts after the sign: nothing in English ("R$80"), a no-break
 * space in Portuguese ("R$ 80"). Null for a language that writes money after the amount ("80 €").
 */
private fun moneySignGap(
    locale: Locale,
    sign: String,
): String? {
    val currency = CURRENCY_SYMBOLS[sign] ?: return null
    val format = NumberFormat.getCurrencyInstance(locale).apply { this.currency = Currency.getInstance(currency) }
    val formatted = format.formatToCharacterIterator(1)
    val text = format.format(1)

    var symbolEnd = -1
    var integerStart = -1
    var index = formatted.beginIndex

    while (index < formatted.endIndex) {
        formatted.index = index
        val attributes = formatted.attributes.keys

        if (NumberFormat.Field.CURRENCY in attributes && symbolEnd == -1) symbolEnd = formatted.runLimit
        if (NumberFormat.Field.INTEGER in attributes && integerStart == -1) integerStart = index

        index = formatted.runLimit
    }

    return if (symbolEnd == -1 || integerStart == -1 || symbolEnd > integerStart) null else text.substring(symbolEnd, integerStart)
}

/**
 * AI-written numbers set the way the learner's language prints them, so they match the readouts
 * and answers beside them, and a number never wraps away from its unit or currency.
 */
internal fun typesetNumbers(
    locale: Locale,
    text: String,
): String {
    val grouping = NumberFormat.getIntegerInstance(locale).apply { isGroupingUsed = true }

    return text
        .replace(LONG_NUMBER) { grouping.format(it.value.toBigInteger()) }
        .replace(NUMBER_THEN_UNIT, NBSP)
        .replace(CURRENCY_THEN_NUMBER) { match ->
            val sign = match.groupValues[1]
            sign + (moneySignGap(locale, sign) ?: NBSP)
        }
}
