package com.zoonk.android.feature.account

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

// On a phone-sized window, Robolectric never idles an OutlinedTextField inside an AlertDialog.
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
class BirthYearQuestionTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val answers = mutableListOf<Long>()
    private var closed = 0
    private var question by mutableStateOf(BirthYearPrompt.Question(canClose = false, saving = false, error = null))

    private fun show() {
        rule.setContent {
            ZoonkTheme { BirthYearQuestion(question, onAnswer = { answers += it }, onClose = { closed++ }) }
        }
    }

    @Test
    fun continueWaitsForFourDigitsAndSendsTheYear() {
        show()
        rule.onNodeWithText("Continue").assertIsNotEnabled()

        rule.onNode(hasSetTextAction()).performTextInput("19a9")
        rule.onNodeWithText("Continue").assertIsNotEnabled()
        rule.onNode(hasSetTextAction()).performTextInput("0")
        rule.onNodeWithText("Continue").assertIsEnabled().performClick()

        assertEquals(listOf(1990L), answers)
    }

    @Test
    fun onlyAVisitorCanSayNotNow() {
        show()
        rule.onNodeWithText("Not now").assertDoesNotExist()

        question = question.copy(canClose = true)
        rule.onNodeWithText("Not now").performClick()

        assertEquals(1, closed)
        assertEquals(emptyList<Long>(), answers)
    }

    @Test
    fun aRefusedYearSaysWhyUntilItsChanged() {
        show()
        rule.onNode(hasSetTextAction()).performTextInput("2030")
        rule.onNodeWithText("Continue").performClick()
        question = question.copy(error = BirthYearError.Invalid)

        rule.onNodeWithText("Check the year and try again.").assertIsDisplayed()

        rule.onNode(hasSetTextAction()).performTextReplacement("1990")
        rule.onNode(hasText("Check the year and try again.")).assertDoesNotExist()
    }
}
