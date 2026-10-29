package com.zoonk.android.ui.format

import android.icu.math.BigDecimal
import android.icu.text.CompactDecimalFormat
import android.icu.text.DecimalFormat
import android.icu.text.DecimalFormatSymbols
import android.icu.text.NumberFormat
import android.icu.util.Currency
import android.icu.util.ULocale
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * A value with the unit content gives it, as main's `useFormatNumber` writes it: money in the
 * currency's own format ("R$ 2.000", "$3.50"), any other unit after the number ("12%", "3 km").
 */
fun formatAmount(
    value: Double,
    locale: Locale,
    unit: String? = null,
    compact: Boolean = false,
    maximumFractionDigits: Int? = null,
    signed: Boolean = false,
): String {
    val money = moneyUnit(unit)
    if (money != null) {
        val amount = formatMoney(value, money.currency, locale, compact, maximumFractionDigits, signed)
        return if (money.rest.isEmpty()) amount else "$amount ${money.rest}"
    }

    val digits = maximumFractionDigits ?: fractionDigitsFor(value)
    val number = if (compact) formatCompact(value, locale, digits) else formatNumber(value, locale, digits, signed = signed)
    return withUnit(number, unit)
}

/** Cents show only when there are some and the amount is small ($3.50, $200, $103,449). */
fun formatMoney(
    value: Double,
    currency: String,
    locale: Locale,
    compact: Boolean = false,
    maximumFractionDigits: Int? = null,
    signed: Boolean = false,
): String {
    val whole = abs(value) >= WHOLE_MONEY_FROM || isWhole(value, MONEY_FRACTION_DIGITS)
    val digits = maximumFractionDigits ?: if (whole) 0 else MONEY_FRACTION_DIGITS
    val minimum = if (isWhole(value, digits)) 0 else min(digits, MONEY_FRACTION_DIGITS)
    val format = currencyFormat(currency, locale, minimum, max(digits, minimum))
    val text =
        if (compact) {
            // The currency's own place and spacing, around the short number.
            val one = currencyFormat(currency, locale, 0, 0).format(1)
            one.replaceFirst(
                NumberFormat.getInstance(ULocale.forLocale(locale)).format(1),
                formatCompact(abs(value), locale, max(digits, minimum), minimum),
            )
        } else {
            format.format(abs(value))
        }

    return when {
        value < 0 -> MINUS_SIGN + text
        signed && value > 0 -> DecimalFormatSymbols.getInstance(ULocale.forLocale(locale)).plusSign + text
        else -> text
    }
}

/** A number answer with its unit, as main's `formatMathAnswer` writes it: money in its currency, tiny values to two significant digits. */
fun formatMathAnswer(
    value: Double,
    locale: Locale,
    unit: String? = null,
): String {
    currencyFor(unit)?.let { return formatMoney(value, it, locale, maximumFractionDigits = MONEY_FRACTION_DIGITS) }

    val size = abs(value)
    val format =
        (NumberFormat.getInstance(ULocale.forLocale(locale)) as DecimalFormat).apply {
            if (size > 0 && size < SMALL_VALUE) {
                setSignificantDigitsUsed(true)
                maximumSignificantDigits = SMALL_VALUE_SIGNIFICANT_DIGITS
            } else {
                maximumFractionDigits = MONEY_FRACTION_DIGITS
            }
            roundingMode = BigDecimal.ROUND_HALF_UP
        }
    val number = format.format(size).let { if (value < 0) MINUS_SIGN + it else it }
    return withUnit(number, unit)
}

/** The ISO code for a unit that is money ("R$", "€", "USD"), null for any other unit. */
fun currencyFor(unit: String?): String? {
    unit ?: return null
    return CURRENCY_SYMBOLS[unit] ?: unit.takeIf { ISO_CODE.matches(it) }
}

fun withUnit(
    formatted: String,
    unit: String?,
): String =
    when {
        unit.isNullOrEmpty() -> formatted
        unit in ATTACHED_UNITS -> "$formatted$unit"
        else -> "$formatted$NO_BREAK_SPACE$unit"
    }

/** Enough decimals to tell small values apart: two up to ten, none from a thousand. */
fun fractionDigitsFor(value: Double): Int {
    val size = abs(value)
    return when {
        size >= THOUSAND -> 0
        size >= TEN -> 1
        size >= 1 -> DEFAULT_FRACTION_DIGITS
        size == 0.0 -> DEFAULT_FRACTION_DIGITS + 1
        else -> min(MAX_FRACTION_DIGITS, max(0, -floor(log10(size)).toInt() - 1) + SMALL_SIGNIFICANT_DIGITS)
    }
}

private data class MoneyUnit(
    val currency: String,
    val rest: String,
)

/** "R$" is money, and so is "R$ per month", whose words stay after the amount. */
private fun moneyUnit(unit: String?): MoneyUnit? {
    currencyFor(unit)?.let { return MoneyUnit(it, "") }
    val words = unit?.split(" ").orEmpty()
    val currency = currencyFor(words.firstOrNull()) ?: return null
    return MoneyUnit(currency, words.drop(1).joinToString(" ")).takeIf { it.rest.isNotEmpty() }
}

private fun formatCompact(
    value: Double,
    locale: Locale,
    maximumFractionDigits: Int,
    minimumFractionDigits: Int = 0,
): String {
    val format =
        CompactDecimalFormat.getInstance(ULocale.forLocale(locale), CompactDecimalFormat.CompactStyle.SHORT).apply {
            setSignificantDigitsUsed(false)
            this.maximumFractionDigits = maximumFractionDigits.coerceIn(0, MAX_FRACTION_DIGITS)
            this.minimumFractionDigits = minimumFractionDigits
            roundingMode = BigDecimal.ROUND_HALF_UP
        }
    val text = format.format(abs(value))
    return if (value < 0) MINUS_SIGN + text else text
}

private fun currencyFormat(
    currency: String,
    locale: Locale,
    minimumFractionDigits: Int,
    maximumFractionDigits: Int,
): NumberFormat =
    NumberFormat.getCurrencyInstance(ULocale.forLocale(locale)).apply {
        this.currency = Currency.getInstance(currency)
        this.minimumFractionDigits = minimumFractionDigits
        this.maximumFractionDigits = maximumFractionDigits
        roundingMode = BigDecimal.ROUND_HALF_UP
    }

private fun isWhole(
    value: Double,
    digits: Int,
): Boolean {
    val scale = TEN.pow(digits)
    return Math.round(value * scale) % scale.toLong() == 0L
}

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

private val ISO_CODE = Regex("^[A-Z]{3}$")
private val ATTACHED_UNITS = setOf("%", "°", "‰")

private const val DEFAULT_FRACTION_DIGITS = 2
private const val SMALL_VALUE = 0.01
private const val SMALL_VALUE_SIGNIFICANT_DIGITS = 2
private const val SMALL_SIGNIFICANT_DIGITS = 3
private const val MONEY_FRACTION_DIGITS = 2
private const val WHOLE_MONEY_FROM = 1_000.0
private const val THOUSAND = 1_000.0
private const val TEN = 10.0
