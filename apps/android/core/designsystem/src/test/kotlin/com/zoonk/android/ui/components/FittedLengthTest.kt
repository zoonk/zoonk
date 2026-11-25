package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.placeCursorAtEnd
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
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

    private fun field(
        text: String,
        maxLength: Int,
    ): TextFieldState {
        val state = TextFieldState(text).apply { edit { placeCursorAtEnd() } }
        compose.setContent { BasicTextField(state, inputTransformation = InputTransformation.fitTo(maxLength)) }
        return state
    }
}
