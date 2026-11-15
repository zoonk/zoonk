package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** RV85's reproductions: when the plan's run fails, its wait is over, and the quiz goes with it, whatever the learner did in it. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SetupFailedRunTest {
    @get:Rule
    val rule = createComposeRule()

    private var run by mutableStateOf(GenerationRun(status = GenerationRun.Status.Following, warmUpId = WARM_UP_ID))

    @Test
    fun anOpenQuizGoesWhenTheRunFails() = failWhileQuizzing(answer = false)

    @Test
    fun anAnsweredQuizGoesWhenTheRunFails() = failWhileQuizzing(answer = true)

    @Test
    fun aLostConnectionKeepsTheQuiz() {
        show()
        rule.onNodeWithText(QUESTION).assertExists()

        rule.runOnIdle { run = run.copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection) }
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText(QUESTION).assertExists()
    }

    private fun failWhileQuizzing(answer: Boolean) {
        show()
        rule.onNodeWithText(QUESTION).assertExists()
        if (answer) rule.onNodeWithText("To hide the bees' alarm scent").performClick()

        rule.runOnIdle { run = run.copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Generation) }
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("Try again").assertExists()
        rule.onNodeWithText(QUESTION).assertDoesNotExist()
    }

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSetupWarmUp provides warmUps) {
                    SetupColumn { PlanBuilding(run, { run = run.copy(status = GenerationRun.Status.Following, failure = null) }) }
                }
            }
        }
        rule.waitForIdle()
    }

    private companion object {
        const val QUESTION = "Why do beekeepers puff smoke into a hive before opening it?"
    }
}
