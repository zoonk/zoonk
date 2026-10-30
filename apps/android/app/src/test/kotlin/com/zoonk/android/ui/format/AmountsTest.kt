package com.zoonk.android.ui.format

import android.icu.text.PluralRules
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * Expected values are what main's `useFormatNumber` and `formatMoney` write for the same input, with
 * ICU's and V8's no-break spaces read as plain ones.
 */
@RunWith(AndroidJUnit4::class)
class AmountsTest {
    private val en = Locale.ENGLISH
    private val pt = Locale.forLanguageTag("pt")
    private val fr = Locale.FRENCH

    @Test
    fun numbersKeepEnoughDecimalsAndTheirUnit() {
        assertEquals("12.5", formatAmount(12.5, en))
        assertEquals("1.234.567", formatAmount(1_234_567.0, pt))
        assertEquals("0,004", formatAmount(0.004, pt))
        assertEquals("−40", formatAmount(-40.0, en))
        assertEquals("12%", formatAmount(12.0, en, "%"))
        assertEquals("1.235\u00A0km", formatAmount(1_234.56, pt, "km"))
    }

    @Test
    fun compactNumbersShortenThousands() {
        assertEquals(
            listOf("0", "250", "1K", "2K", "25K", "1M"),
            listOf(0.0, 250.0, 1_000.0, 1_500.0, 25_000.0, 1_234_567.0).map {
                formatAmount(it, en, compact = true)
            },
        )
        assertEquals(
            listOf("1 mil", "25 mil", "1 mi"),
            listOf(1_000.0, 25_000.0, 1_234_567.0).map { formatAmount(it, pt, compact = true).plain() },
        )
    }

    private fun String.plain() = replace(Regex("[\u00A0\u202F]"), " ")

    private fun money(
        value: Double,
        locale: Locale,
        unit: String,
        compact: Boolean = false,
    ) = formatAmount(value, locale, unit, compact).plain()

    @Test
    fun moneyShowsCentsOnlyWhenSmallAndNotWhole() {
        assertEquals(listOf("$3.50", "$200", "$103,449", "−$12"), listOf(3.5, 200.0, 103_449.0, -12.0).map { money(it, en, "$") })
        assertEquals(listOf("R$ 3,50", "R$ 2.000"), listOf(3.5, 2_000.0).map { money(it, pt, "R$") })
        assertEquals("3,50 €", money(3.5, fr, "€"))
        assertEquals("$2K", money(2_000.0, en, "$", compact = true))
        assertEquals("$3.50", money(3.5, en, "$", compact = true))
        assertEquals("R$ 2 mil", money(2_000.0, pt, "R$", compact = true))
        assertEquals("R$ 1.200 per month", money(1_200.0, pt, "R$ per month"))
    }

    @Test
    fun aDecimalAmountTakesThePluralItsLanguageGivesIt() {
        val category = { value: Double, locale: Locale -> PluralRules.forLocale(locale).select(pluralQuantity(value, locale).toDouble()) }

        assertEquals(
            listOf("other", "one", "other", "one", "other", "one", "one", "other", "other"),
            listOf(
                1.5 to en,
                1.0 to en,
                5.0 to en,
                1.5 to fr,
                2.5 to fr,
                0.3 to pt,
                1.5 to pt,
                1.5 to Locale.GERMAN,
                1.5 to Locale.forLanguageTag("es"),
            ).map { (value, locale) -> category(value, locale) },
        )
    }
}
