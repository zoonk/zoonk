package com.zoonk.android.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import org.junit.Assert.assertEquals
import org.junit.Test

class NumberUnitTransformationTest {
    @Test fun aSignSuffixClosesUpOnItsNumberWithoutEnteringTheSavedAnswer() {
        val shown = NumberUnitTransformation("°", prefix = false, Color.Gray).filter(AnnotatedString("180"))
        assertEquals("180°", shown.text.text)
        assertEquals(3, shown.offsetMapping.originalToTransformed(3))
        assertEquals(3, shown.offsetMapping.transformedToOriginal(4))
    }

    @Test fun aSignPrefixClosesUpAndKeepsTheCaretOnTheEditableNumber() {
        val shown = NumberUnitTransformation("$", prefix = true, Color.Gray).filter(AnnotatedString("25"))
        assertEquals("$25", shown.text.text)
        assertEquals(1, shown.offsetMapping.originalToTransformed(0))
        assertEquals(0, shown.offsetMapping.transformedToOriginal(0))
        assertEquals(2, shown.offsetMapping.transformedToOriginal(3))
    }

    @Test fun aWordUnitKeepsItsSpace() {
        assertEquals("3\u00A0kg", NumberUnitTransformation("kg", prefix = false, Color.Gray).filter(AnnotatedString("3")).text.text)
        assertEquals("R$\u00A080", NumberUnitTransformation("R$", prefix = true, Color.Gray).filter(AnnotatedString("80")).text.text)
    }
}
