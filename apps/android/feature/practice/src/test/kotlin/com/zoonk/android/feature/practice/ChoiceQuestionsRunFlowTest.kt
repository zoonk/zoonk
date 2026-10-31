package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChoiceQuestionsRunFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val questions =
        listOf(
            Question("00000000-0000-4000-8000-000000000001", QuestionFormat.MultipleChoice, "Which is a planet?", listOf("Mars", "Moon")),
            Question("00000000-0000-4000-8000-000000000002", QuestionFormat.MultipleChoice, "Which is a star?", listOf("Sun", "Venus")),
        )
    private val answers = mutableListOf<Answer>()

    private fun show() {
        rule.setContent {
            ZoonkTheme {
                val answered = remember { mutableStateListOf<Answer>() }
                ChoiceQuestionsRun(
                    title = "Test out: Planets",
                    questions = questions,
                    answered = answered.size,
                    words = TrueFalseWords.TrueFalse,
                    app = AppContainer.preview(rule.activity),
                    screen = "test-out",
                    pending = false,
                    failed = false,
                    onAnswer = { _, answer ->
                        answered += answer
                        answers += answer
                    },
                    onSend = {},
                    onClose = {},
                    hint = { "80% right skips the chapter. No feedback until the end." },
                )
            }
        }
    }

    @Test
    fun aPickGoesOnWithoutFeedbackAndTheLastOneFinishes() {
        show()

        rule.onNodeWithText("80% right skips the chapter. No feedback until the end.").assertExists()
        rule.onNodeWithText("Next").assertIsNotEnabled()
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Next").assertIsEnabled().performClick()

        rule.onNodeWithText("Which is a star?").assertExists()
        rule.onNodeWithText("Correct", substring = true).assertDoesNotExist()
        rule.onNodeWithText("Finish").assertIsNotEnabled()
        rule.onNodeWithText("I don't know yet").performClick()

        assertEquals(listOf(Answer.Choice(0), Answer.DontKnow), answers)
    }

    private fun showWaiting(ended: Boolean) {
        rule.setContent {
            ZoonkTheme {
                ChoiceQuestionsRun(
                    title = "Focus test",
                    questions = questions,
                    answered = questions.size,
                    words = TrueFalseWords.TrueFalse,
                    app = AppContainer.preview(rule.activity),
                    screen = "focus-test",
                    pending = false,
                    failed = false,
                    onAnswer = { _, answer -> answers += answer },
                    onSend = { sends++ },
                    onClose = {},
                    upcoming = UpcomingQuestions(total = 4, ended = ended),
                    waiting = { Text("Your next questions are on the way") },
                )
            }
        }
    }

    private var sends = 0

    @Test
    fun runningOutOfQuestionsWaitsForTheNextOnes() {
        showWaiting(ended = false)

        rule.onNodeWithText("Your next questions are on the way").assertExists()
        rule.onNodeWithText("Finish with these answers").assertDoesNotExist()
    }

    @Test
    fun theAnswersGivenCanBeSentOnceTheRestWontCome() {
        showWaiting(ended = true)

        rule.onNodeWithText("Finish with these answers").performClick()

        assertEquals(1, sends)
    }

    @Test
    fun aSendThatFailedKeepsTheLastQuestionWithTryAgain() {
        var retries = 0
        rule.setContent {
            ZoonkTheme {
                ChoiceQuestionsRun(
                    title = "Test out: Planets",
                    questions = questions,
                    answered = questions.size,
                    words = TrueFalseWords.TrueFalse,
                    app = AppContainer.preview(rule.activity),
                    screen = "test-out",
                    pending = false,
                    failed = true,
                    onAnswer = { _, answer -> answers += answer },
                    onSend = { retries++ },
                    onClose = {},
                )
            }
        }

        rule.onNodeWithText("Which is a star?").assertExists()
        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertExists()
        rule.onNodeWithText("Try again").performClick()

        assertEquals(1, retries)
        assertEquals(emptyList<Answer>(), answers)
    }
}
