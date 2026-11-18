package com.zoonk.android.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/** The field writes its unit as the answer's feedback does, in the learner's language. */
@RunWith(AndroidJUnit4::class)
class NumberUnitTransformationTest {
    private fun shown(
        unit: String,
        typed: String,
        locale: Locale,
    ) = NumberUnitTransformation(unit, locale, Color.Gray).filter(AnnotatedString(typed))

    @Test fun aDegreeClosesUpOnItsNumberWithoutEnteringTheSavedAnswer() {
        val field = shown("°", "180", Locale.ENGLISH)
        assertEquals("180°", field.text.text)
        assertEquals(3, field.offsetMapping.originalToTransformed(3))
        assertEquals(3, field.offsetMapping.transformedToOriginal(4))
    }

    @Test fun moneyTakesTheLearnersOwnSignAndGap() {
        assertEquals("R$80", shown("R$", "80", Locale.ENGLISH).text.text)
        assertEquals("R$\u00A080", shown("R$", "80", Locale.forLanguageTag("pt-BR")).text.text)
        assertEquals("25\u00A0€", shown("€", "25", Locale.GERMAN).text.text)
    }

    @Test fun aPrefixKeepsTheCaretOnTheEditableNumber() {
        val field = shown("$", "25", Locale.ENGLISH)
        assertEquals("$25", field.text.text)
        assertEquals(1, field.offsetMapping.originalToTransformed(0))
        assertEquals(2, field.offsetMapping.transformedToOriginal(3))
    }

    @Test fun aWordUnitKeepsItsSpace() {
        assertEquals("3\u00A0kg", shown("kg", "3", Locale.ENGLISH).text.text)
    }
}
