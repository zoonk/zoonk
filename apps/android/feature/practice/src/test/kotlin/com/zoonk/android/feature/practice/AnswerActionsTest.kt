package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.requestFocus
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AnswerActionsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var run by mutableStateOf(QuestionRun(index = 0, phase = RunPhase.Answering, stage = DrillStage.Open))
    private val sent = mutableListOf<AnswerSender>()

    private fun show() {
        val question = question()
        val controls =
            object : RunControls {
                override val canRetry = false

                override fun startDrill(questions: List<Question>) = Unit

                override fun reveal() = Unit

                override fun submit(
                    question: Question,
                    answer: Answer,
                    sender: AnswerSender,
                    minDurationMs: Long,
                ) {
                    sent += sender
                }

                override fun retry() = Unit

                override fun timeUp(
                    question: Question,
                    seconds: Int,
                ) = Unit

                override fun next(questions: List<Question>) = Unit
            }

        rule.setContent {
            ZoonkTheme {
                AnswerActions(listOf(question), question, run, Answer.Choice(0), controls, ask = {}, notSureOnEvery = true)
            }
        }
    }

    private fun spinners() = rule.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true)

    private fun spinnersIn(button: String) =
        rule.onAllNodes(
            hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate) and hasAnySibling(hasText(button)),
            useUnmergedTree = true,
        )

    private fun checking(sender: AnswerSender) {
        run = run.checking(sender)
        rule.waitForIdle()
    }

    @Test
    fun checkKeepsFocusAndSpinsWhileTheClocksAnswerIsChecked() {
        show()
        rule.onNodeWithText("Check").requestFocus().assertIsFocused()

        checking(AnswerSender.Timer)

        rule
            .onNodeWithText("Check")
            .assertIsFocused()
            .assertIsNotEnabled()
            .performClick()
        spinners().assertCountEquals(1)
        spinnersIn("Check").assertCountEquals(1)
        assertEquals(emptyList<AnswerSender>(), sent)
    }

    @Test
    fun notSureKeepsFocusAndOnlyCheckSpinsWhileTheClocksAnswerIsChecked() {
        show()
        rule.onNodeWithText("I don't know yet").requestFocus().assertIsFocused()

        checking(AnswerSender.Timer)

        rule.onNodeWithText("I don't know yet").assertIsFocused().assertIsNotEnabled()
        spinners().assertCountEquals(1)
        spinnersIn("Check").assertCountEquals(1)
    }

    @Test
    fun notSureKeepsFocusAndOnlyCheckSpinsWhileChecksAnswerIsChecked() {
        show()
        rule.onNodeWithText("I don't know yet").requestFocus().assertIsFocused()

        checking(AnswerSender.Check)

        rule
            .onNodeWithText("I don't know yet")
            .assertIsFocused()
            .assertIsNotEnabled()
            .performClick()
        spinners().assertCountEquals(1)
        spinnersIn("Check").assertCountEquals(1)
        assertEquals(emptyList<AnswerSender>(), sent)
    }

    private fun question(): Question {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val detail = blockDetail(listOf(blockQuestion(ITEM, "question" to "Which is a planet?", "options" to strings("Mars", "Moon"))))
        return practiceViewModel(cache, detail).questions(detail).questions.single()
    }

    private companion object {
        const val ITEM = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
    }
}
