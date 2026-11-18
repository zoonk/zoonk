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

/** A postal code's label right before it ("ZIP 94103", "PLZ 10115"), or a city's state code ("San Francisco, CA 94103"). */
private val POSTAL_LABEL =
    Regex("\\b(?:zip(?: code)?|postal code|postcode|plz|postleitzahl|cep|cp|code postal|código postal):?\\s$", RegexOption.IGNORE_CASE)

private val STATE_CODE = Regex(",\\s\\p{Lu}{2},?\\s$")

private fun isPostalCode(before: String) = POSTAL_LABEL.containsMatchIn(before) || STATE_CODE.containsMatchIn(before)

private val NUMBER_THEN_WORD = Regex("(?<=[0-9])[ \t]+(?=[\\p{L}%°])")

/** A sign and its amount, apart by a space or by the no-break space a question's text already keeps them with. */
private val CURRENCY_THEN_NUMBER = Regex("(\\p{Lu}{0,2}\\p{Sc})[ \\u00A0](?=[0-9])")

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
 * and answers beside them, and a number never wraps away from the word, unit or currency beside it.
 */
internal fun typesetNumbers(
    locale: Locale,
    text: String,
    group: Boolean = true,
): String {
    val together = text.replace(NUMBER_THEN_WORD, NBSP)
    if (!group) return typesetMoney(locale, together)

    val grouping = NumberFormat.getIntegerInstance(locale).apply { isGroupingUsed = true }

    return typesetMoney(
        locale,
        together
            .replace(LONG_NUMBER) { number ->
                if (isPostalCode(together.substring(0, number.range.first))) number.value else grouping.format(number.value.toBigInteger())
            },
    )
}

/**
 * Only money set the way the learner's money format writes it, for a question's own text, whose other digits
 * (a code in a table, an ID, a count it asks about) stay as written.
 */
fun typesetMoney(
    locale: Locale,
    text: String,
): String =
    text.replace(CURRENCY_THEN_NUMBER) { match ->
        val sign = match.groupValues[1]
        sign + (moneySignGap(locale, sign) ?: NBSP)
    }
