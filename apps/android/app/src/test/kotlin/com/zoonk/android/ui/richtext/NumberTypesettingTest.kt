package com.zoonk.android.ui.richtext

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

private const val NBSP = "\u00A0"

/** Main's `rich-text-typography.test.ts` cases. */
class NumberTypesettingTest {
    private val english = Locale.ENGLISH
    private val portuguese = Locale.forLanguageTag("pt")
    private val german = Locale.GERMAN

    @Test
    fun groupsLongNumbersTheLearnersWay() {
        assertEquals(
            "Um quilo de gordura guarda 350.000${NBSP}kcal.",
            typesetNumbers(portuguese, "Um quilo de gordura guarda 350000 kcal."),
        )
        assertEquals("About 12,000 people, in 2026.", typesetNumbers(english, "About 12000 people, in 2026."))
    }

    @Test
    fun keepsANumberWithItsUnitOrCurrencyOnOneLine() {
        assertEquals("uma marcada 3${NBSP}Ω e outra 6${NBSP}Ω", typesetNumbers(portuguese, "uma marcada 3 Ω e outra 6 Ω"))
        assertEquals("custa R$${NBSP}80 e pesa 2${NBSP}kg", typesetNumbers(portuguese, "custa R$ 80 e pesa 2 kg"))
        assertEquals("kostet €${NBSP}20", typesetNumbers(german, "kostet € 20"))
    }

    @Test
    fun writesMoneyTheWayTheReadoutsAndAnswersBesideItDo() {
        assertEquals(
            "Slide the discount on the R$80 T-shirt. The line drops R$8 for every 10%.",
            typesetNumbers(english, "Slide the discount on the R$ 80 T-shirt. The line drops R$ 8 for every 10%."),
        )
        assertEquals("US$5 or £4", typesetNumbers(english, "US$ 5 or £ 4"))
        assertEquals("R$60", typesetNumbers(english, "R$ 60"))
        assertEquals("R$${NBSP}60", typesetNumbers(portuguese, "R$ 60"))
    }

    @Test
    fun leavesDecimalsCodesYearsAndNumbersBeforeLongerWordsAlone() {
        val text = "1,5 mais 12345,67 no CEP 01310-100 em 2026 com 5 pessoas e ID 123456789a"
        assertEquals(text, typesetNumbers(portuguese, text))
    }
}
