package com.zoonk.android.ui.components

import android.content.res.Configuration
import org.junit.Assert.assertEquals
import org.junit.Test

class AnswerKeyTest {
    @Test
    fun touchChoicesHaveNoKeyboardSlot() {
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_NOKEYS, checked = false, ordered = false))
    }

    @Test
    fun checkingKeepsTheKeyboardSlotButHidesItsKey() {
        assertEquals(AnswerKey.Visible, answerKey(Configuration.KEYBOARD_QWERTY, checked = false, ordered = false))
        assertEquals(AnswerKey.Hidden, answerKey(Configuration.KEYBOARD_QWERTY, checked = true, ordered = false))
    }

    @Test
    fun orderedChoicesKeepTheirTagWithoutAKey() {
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_QWERTY, checked = false, ordered = true))
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_QWERTY, checked = true, ordered = true))
    }
}
