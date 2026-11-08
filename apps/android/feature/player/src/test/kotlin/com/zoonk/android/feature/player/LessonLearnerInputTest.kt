package com.zoonk.android.feature.player

import android.accessibilityservice.AccessibilityServiceInfo
import android.view.ViewGroup
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.language.matchColumns
import com.zoonk.android.feature.player.language.reading
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf

/** A run that lands late keeps the learner's screen once they touched or typed in the lesson, and only then. */
@RunWith(AndroidJUnit4::class)
class LessonLearnerInputTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule val folder = TemporaryFolder()

    private val harness by lazy { LessonPlayerHarness(rule) { folder.newFolder() } }

    private val shown get() =
        harness.viewModel.state.value
            ?.currentStep
            ?.id

    /** The run, which already holds an answer for [answered], starts only when the test lets it. */
    private fun FakeLessonPlayerApi.holdsStart(answered: String) {
        startGate = CompletableDeferred()
        runAnswers = "[${runAnswerJson(answered, true, answeredAt = EARLIER_SITTING)}]"
    }

    private fun runLands() {
        harness.api.startGate!!.complete(Unit)
        rule.waitUntil {
            harness.viewModel.state.value
                ?.run is LessonRun.Started
        }
        rule.waitForIdle()
    }

    @Test fun aFirstMatchPickKeepsItsScreen() {
        harness.play(listOf(matchColumns(STEP), summaryStep(END)), withSpeech = true) { holdsStart(STEP) }

        harness.tap("hola")
        runLands()

        assertEquals(STEP, shown)
    }

    @Test fun aFirstSentenceTileKeepsItsScreen() {
        harness.play(listOf(reading(STEP), summaryStep(END)), withSpeech = true) { holdsStart(STEP) }

        harness.tap("Yo")
        runLands()

        assertEquals(STEP, shown)
    }

    @Test fun aRecordingStartedBeforeTheRunKeepsItsScreen() {
        harness.play(listOf(spokenStep(STEP), summaryStep(END)), withSpeech = true) { holdsStart(STEP) }

        harness.tap("Record")
        runLands()

        assertEquals(STEP, shown)
    }

    /** TalkBack and Switch Access click through the screen's accessibility actions, not with a touch. */
    @Test fun aTalkBackClickKeepsItsScreen() {
        val manager = shadowOf(rule.activity.getSystemService(AccessibilityManager::class.java))
        manager.setEnabled(true)
        manager.setTouchExplorationEnabled(true)
        manager.setEnabledAccessibilityServiceList(listOf(AccessibilityServiceInfo()))
        harness.play(listOf(matchColumns(STEP), summaryStep(END)), withSpeech = true) { holdsStart(STEP) }

        val node = rule.onNodeWithText("hola").fetchSemanticsNode()
        val content = rule.activity.findViewById<ViewGroup>(android.R.id.content)
        val owner = (content.getChildAt(0) as ViewGroup).getChildAt(0)
        rule.runOnUiThread { owner.accessibilityNodeProvider.performAction(node.id, AccessibilityNodeInfo.ACTION_CLICK, null) }
        runLands()

        assertEquals(STEP, shown)
    }

    @Test fun aLearnerWhoOnlyScrolledIsResumed() {
        harness.play(listOf(matchColumns(STEP), summaryStep(END)), withSpeech = true) { holdsStart(STEP) }

        rule.onRoot().performTouchInput { swipeUp() }
        runLands()

        assertEquals(END, shown)
    }

    /** Android closed the app in the background: the sentence's tiles come back on their own, so the learner is resumed. */
    @Test fun restoredTilesAreNotTheLearnersInput() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(reading(STEP), summaryStep(END)), restoration = restoration, withSpeech = true)
        listOf("Yo", "veo", "un", "gato.").forEach(harness::tap)

        harness.api.holdsStart(STEP)
        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
        runLands()

        assertEquals(END, shown)
    }

    private companion object {
        const val STEP = "00000000-0000-4000-8000-000000000301"
        const val END = "00000000-0000-4000-8000-000000000302"
    }
}
