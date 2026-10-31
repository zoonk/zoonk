package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

private const val MISSES_OFFER = "This one is tricky. Sam can explain it another way."
private const val PAUSE_OFFER = "Taking your time? Sam can explain it another way."

@RunWith(AndroidJUnit4::class)
class AskBuddyOfferTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun missQuiz() {
        harness.tap("Wrong")
        harness.tap("Check")
        rule.onNodeWithText("Not quite").assertIsDisplayed()
    }

    @Test
    fun twoMissesOnOneQuestionOfferTheBuddy() {
        harness.play(listOf(explanationStep("idea"), checkStep("quiz")), withTutor = true)
        harness.tap("Next")
        missQuiz()
        rule.onAllNodesWithText(MISSES_OFFER).assertCountEquals(0)

        harness.tap("Continue")
        missQuiz()

        rule.onNodeWithText(MISSES_OFFER).performScrollTo().assertIsDisplayed()
        harness.tap("Ask Sam")
        rule.runOnIdle { assertTrue(harness.tutorAsked) }
        rule.onAllNodesWithText(MISSES_OFFER).assertCountEquals(0)
    }

    @Test
    fun aQuestionTheBuddyWasAskedAboutOffersNoMoreHelpWhenItComesBack() {
        harness.play(listOf(explanationStep("idea"), checkStep("quiz")), withTutor = true)
        harness.tap("Next")
        missQuiz()
        harness.tap("Ask buddy")

        harness.tap("Continue")
        missQuiz()

        rule.onAllNodesWithText(MISSES_OFFER).assertCountEquals(0)
    }

    @Test
    fun aShownPauseOfferStaysWhenTheActivityIsRecreated() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(explanationStep("idea"), summaryStep("end")), restoration = restoration, withTutor = true)
        rule.mainClock.advanceTimeBy(46_000)
        rule.onNodeWithText(PAUSE_OFFER).performScrollTo().assertIsDisplayed()

        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithText(PAUSE_OFFER).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aLongPauseOnAnExplanationOffersTheBuddyUntilNoThanks() {
        harness.play(listOf(explanationStep("idea"), summaryStep("end")), withTutor = true)
        rule.mainClock.advanceTimeBy(40_000)
        rule.onAllNodesWithText(PAUSE_OFFER).assertCountEquals(0)

        rule.mainClock.advanceTimeBy(6_000)

        rule.onNodeWithText(PAUSE_OFFER).performScrollTo().assertIsDisplayed()
        harness.tap("No thanks")
        rule.onAllNodesWithText(PAUSE_OFFER).assertCountEquals(0)
    }
}
