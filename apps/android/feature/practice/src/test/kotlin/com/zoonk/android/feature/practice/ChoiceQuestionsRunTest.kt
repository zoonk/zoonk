package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.text.style.LineBreak
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.ui.testing.laidOutStyle
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class ChoiceQuestionsRunTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private lateinit var inputMode: InputModeManager
    private var answered by mutableIntStateOf(0)
    private var pending by mutableStateOf(false)
    private var presses = 0

    private fun show(hint: String? = null) {
        rule.setContent {
            ZoonkTheme {
                inputMode = LocalInputModeManager.current
                ChoiceQuestionsRun(
                    title = "Test out",
                    questions = listOf(QUESTION),
                    answered = answered,
                    words = TrueFalseWords.TrueFalse,
                    app = AppContainer.preview(rule.activity),
                    screen = "test-out",
                    pending = pending,
                    failures = 0,
                    onAnswer = { _, _ -> presses++ },
                    onSend = { presses++ },
                    onClose = {},
                    hint = { hint },
                )
            }
        }
    }

    private fun sendingTheAnswers() {
        answered = 1
        pending = true
        rule.waitForIdle()
    }

    /** A hint is a sentence, so it wraps as every sentence does, with the normal rules. */
    @Config(qualifiers = "ja")
    @Test
    fun aHintWrapsByTheNormalRules() {
        show(hint = "惑星はどれですか")

        assertNotEquals(LineBreak.Strictness.Strict, rule.laidOutStyle("惑星").lineBreak.strictness)
    }

    @Test
    fun onlyFinishSpinsWhileTheAnswersItSentGoOutAndNotSureKeepsFocus() {
        show()
        rule.onNodeWithText("Mars").performClick()
        rule.onNodeWithText("Finish").performClick()
        rule.runOnIdle { assertTrue(inputMode.requestInputMode(InputMode.Keyboard)) }
        rule.onNodeWithText("I don't know yet").requestFocus().assertIsFocused()

        sendingTheAnswers()

        rule
            .onNodeWithText("I don't know yet")
            .assertIsFocused()
            .assertIsNotEnabled()
            .performClick()
        rule.assertOnlySpinnerOver("Finish")
        assertEquals(1, presses)
    }

    @Test
    fun onlyNotSureSpinsWhileTheAnswersItSentGoOutAndFinishKeepsFocus() {
        show()
        rule.onNodeWithText("Mars").performClick()
        rule.onNodeWithText("I don't know yet").performClick()
        rule.runOnIdle { assertTrue(inputMode.requestInputMode(InputMode.Keyboard)) }
        rule.onNodeWithText("Finish").requestFocus().assertIsFocused()

        sendingTheAnswers()

        rule
            .onNodeWithText("Finish")
            .assertIsFocused()
            .assertIsNotEnabled()
            .performClick()
        rule.assertOnlySpinnerOver("I don't know yet")
        assertEquals(1, presses)
    }

    private companion object {
        val QUESTION =
            Question("00000000-0000-4000-8000-000000000001", QuestionFormat.MultipleChoice, "Which is a planet?", listOf("Mars", "Moon"))
    }
}
