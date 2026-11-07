package com.zoonk.android.ui.components

import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Test

class ReadoutTest {
    private val unit = SpanStyle(fontSize = 15.sp)

    private fun smallParts(text: String) = readout(text, unit).spanStyles.map { text.substring(it.start, it.end) }

    @Test
    fun wordsAfterTheNumberAreItsUnit() {
        assertEquals(listOf(" min left"), smallParts("43 min left"))
        assertEquals(listOf(" min / ", " hr"), smallParts("54 min / 5 hr"))
    }

    @Test
    fun aPercentSignIsPartOfTheNumber() {
        assertEquals(emptyList<String>(), smallParts("70%"))
        assertEquals(emptyList<String>(), smallParts("70\u202F%"))
        assertEquals(listOf(" left"), smallParts("16% left"))
    }
}
