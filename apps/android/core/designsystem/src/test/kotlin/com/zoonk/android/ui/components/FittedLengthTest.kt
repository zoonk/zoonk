package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.then
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.TextRange
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FittedLengthTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun deletingFromTextAlreadyOverTheLimitKeepsTheRest() {
        val state = field("abcdefgh", maxLength = 5)
        compose.onNode(hasSetTextAction()).performTextReplacement("abcdefg")
        assertEquals("abcdefg", state.text.toString())
    }

    @Test
    fun typingIntoTextOverTheLimitIsRefused() {
        val state = field("abcdefgh", maxLength = 5)
        compose.onNode(hasSetTextAction()).performTextInput("z")
        assertEquals("abcdefgh", state.text.toString())
    }

    @Test
    fun anInsertionKeepsOnlyTheWholeCharactersThatFit() {
        val state = field("abcd", maxLength = 6)
        compose.onNode(hasSetTextAction()).performTextInput("x😀y")
        assertEquals("abcdx", state.text.toString())
    }

    @Test
    fun anEmojiWithoutRoomForBothHalvesIsRefused() {
        val state = field("abcd", maxLength = 5)
        compose.onNode(hasSetTextAction()).performTextInput("😀")
        assertEquals("abcd", state.text.toString())
    }

    @Test
    fun pastingBeforeAnEmojiKeepsTheExistingEmoji() {
        val original = "😀abcdefghijklmnopqrstu"
        val state = field(original, maxLength = 24, cursor = 0)
        compose.onNode(hasSetTextAction()).performTextInput("😁")
        val actual = state.text.toString()
        assertEquals("UTF-16 units: ${actual.map { it.code.toString(16) }}", original, actual)
    }

    @Test
    fun pastingBetweenTwoEmojiKeepsBothExistingEmoji() {
        val state = field("😀😂", maxLength = 5, cursor = 2)
        compose.onNode(hasSetTextAction()).performTextInput("😁")
        assertEquals("😀😂", state.text.toString())
    }

    @Test
    fun theLastOfSeveralInsertionsTrimsFirst() {
        val state = field("keep", maxLength = 6, cursor = 0, beforeFit = InputTransformation { append("x😂") })
        compose.onNode(hasSetTextAction()).performTextInput("😀")
        assertEquals("😀keep", state.text.toString())
    }

    private fun field(
        text: String,
        maxLength: Int,
        cursor: Int = text.length,
        beforeFit: InputTransformation? = null,
    ): TextFieldState {
        val state = TextFieldState(text, initialSelection = TextRange(cursor))
        val fit = InputTransformation.fitTo(maxLength)
        compose.setContent { BasicTextField(state, inputTransformation = beforeFit?.then(fit) ?: fit) }
        return state
    }
}
