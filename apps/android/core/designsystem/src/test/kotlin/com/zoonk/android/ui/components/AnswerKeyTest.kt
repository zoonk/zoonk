package com.zoonk.android.ui.components

import android.content.res.Configuration
import org.junit.Assert.assertEquals
import org.junit.Test

class AnswerKeyTest {
    @Test
    fun touchChoicesHaveNoKeyboardSlot() {
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_NOKEYS, checked = false, ordered = false, keyed = true))
    }

    @Test
    fun checkingKeepsTheKeyboardSlotButHidesItsKey() {
        assertEquals(AnswerKey.Visible, answerKey(Configuration.KEYBOARD_QWERTY, checked = false, ordered = false, keyed = true))
        assertEquals(AnswerKey.Hidden, answerKey(Configuration.KEYBOARD_QWERTY, checked = true, ordered = false, keyed = true))
    }

    @Test
    fun orderedChoicesKeepTheirTagWithoutAKey() {
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_QWERTY, checked = false, ordered = true, keyed = true))
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_QWERTY, checked = true, ordered = true, keyed = true))
    }

    @Test
    fun optionsNoKeyPicksShowNoKey() {
        assertEquals(AnswerKey.None, answerKey(Configuration.KEYBOARD_QWERTY, checked = false, ordered = false, keyed = false))
    }
}
