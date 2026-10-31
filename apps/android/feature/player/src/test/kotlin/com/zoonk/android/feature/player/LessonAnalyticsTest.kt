package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.model.StepKind
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonAnalyticsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun tap(text: String) = rule.onNodeWithText(text).performClick()

    @Test
    fun aGuessAndAnActivityTheDeviceGradesAreCounted() {
        harness.play(listOf(hookGuessStep("hook"), activityStep("act"), summaryStep("end")))

        rule.onNodeWithText("No").performScrollTo().performClick()
        tap("See the answer")
        tap("Continue")
        tap("Line A")
        tap("Check")

        assertEquals(
            listOf(AnalyticsEvent.HookAnswered(LESSON_ID), AnalyticsEvent.ActivityUsed(LESSON_ID, "notInTheApp")),
            harness.tracked,
        )
    }

    @Test
    fun leavingAStartedRunCountsItAbandonedOnce() {
        harness.play(listOf(checkStep("one"), checkStep("two"), summaryStep("end")))
        tap("Wrong")
        tap("Check")
        tap("Continue")

        rule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        rule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        rule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)

        assertEquals(
            listOf(AnalyticsEvent.ActivityAbandoned(LESSON_ID, screen = 2, stepKind = StepKind.Check, wrongInARow = 1)),
            harness.tracked,
        )
    }

    @Test
    fun aFinishedRunIsNotAbandoned() {
        harness.play(listOf(checkStep("one"), summaryStep("end")))
        tap("Right")
        tap("Check")
        tap("Continue")
        tap("Continue")
        rule.waitUntil(timeoutMillis = 5_000) {
            harness.viewModel.state.value
                ?.phase == LessonPhase.Completed
        }

        rule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)

        assertEquals(emptyList<AnalyticsEvent>(), harness.tracked)
    }
}
