package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.language.reading
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.api.ApiJson
import com.zoonk.api.models.SpokenAnswerGrade
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonPlayerFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }
    private val session get() = harness.session
    private val closed get() = harness.closed
    private val api get() = harness.api
    private val openAgain get() = harness.openAgain
    private val viewModel get() = harness.viewModel

    private fun play(
        steps: List<LessonStep>,
        configure: FakeLessonPlayerApi.() -> Unit = {},
    ) = harness.play(steps, configure = configure)

    private fun tap(text: String) = rule.onNodeWithText(text).performClick()

    /** Going back to reread keeps the screen the learner left, so a sentence half built is still there when they return. */
    @Test
    fun previousKeepsAHalfBuiltSentenceForWhenTheLearnerReturns() {
        play(listOf(explanationStep("intro"), reading("read"), summaryStep("end")))
        tap("Next")
        rule
            .onAllNodesWithText("gato.")
            .onFirst()
            .performClick()

        rule.onNodeWithContentDescription("Previous screen").performClick()
        tap("Next")

        rule.onNodeWithContentDescription("Position 1: gato.").assertExists()
    }

    @Test
    fun aSavedAnswerMarksTheLessonStartedWithoutReadingItAgain() {
        play(listOf(checkStep("quiz"), summaryStep("end")))

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()

        assertEquals(
            LoadState.Loaded(true),
            harness.catalog.lessonStarted[LESSON_ID]
                .state.value,
        )
        assertTrue(harness.catalogApi.reads.none { it.startsWith("started:") })
    }

    @Test
    fun anAnswerTheServerDidNotCheckLeavesTheLessonUnstarted() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { grade = { _, _ -> checkResult(isCorrect = true, checked = false) } }

        tap("Right")
        tap("Check")
        rule.waitUntil { api.checks.isNotEmpty() }
        rule.waitForIdle()

        assertEquals(
            LoadState.Idle,
            harness.catalog.lessonStarted[LESSON_ID]
                .state.value,
        )
    }

    @Test
    fun aGradedSpokenTakeMarksTheLessonStarted() {
        play(listOf(spokenStep("say"), summaryStep("end"))) {
            spokenGrade = {
                ApiJson.decodeFromString(
                    SpokenAnswerGrade.serializer(),
                    """
                    {"attemptId":"00000000-0000-4000-8000-000000000021","explanation":null,"isCorrect":true,"score":1,
                     "transcript":"Tengo hambre","words":[],"wordsToPractice":[]}
                    """.trimIndent(),
                )
            }
        }

        runBlocking { viewModel.gradeSpoken("say", VoiceRecording(ByteArray(8), 1_200)) }

        assertEquals(
            LoadState.Loaded(true),
            harness.catalog.lessonStarted[LESSON_ID]
                .state.value,
        )
    }

    @Test
    fun anAnswerThatDidNotSaveIsSentAgainUnderItsAttemptBeforeFinishing() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        tap("Continue")
        tap("Continue")

        rule.onNodeWithText("Lesson complete").assertIsDisplayed()
        val attempts = api.checks.map { it.second.attemptId }
        assertEquals(2, attempts.size)
        assertEquals(1, attempts.distinct().size)
        assertEquals(listOf(RUN_ID), api.completions)
    }

    @Test
    fun aLessonFinishedAfterAnotherLearnerSignedInIsNotSavedForThem() {
        play(listOf(checkStep("quiz"), summaryStep("end")))

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()
        session.session = AuthenticatedSession("bia", "token-b", "local-b")
        tap("Continue")
        tap("Continue")
        rule.waitForIdle()

        assertEquals(emptyList<String>(), api.completions)
    }

    @Test
    fun aRunWaitsWhileAnAnswerTheAppNeverSentStillCantGetThrough() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 2 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()

        val reopened = openAgain()
        rule.waitUntil(timeoutMillis = 5_000) { reopened.state.value?.run != null && reopened.state.value?.run !is LessonRun.Starting }

        assertEquals(LessonRun.Refused(LessonRefusal.Failed), reopened.state.value?.run)
    }

    @Test
    fun theChapterPageShowsTheChapterTheLessonsEndRead() {
        play(listOf(checkStep("quiz")))

        tap("Right")
        tap("Check")
        tap("Continue")
        rule.onNodeWithText("Next lesson").assertIsDisplayed()
        assertEquals(1, harness.chapterApi.reads)
        runBlocking { harness.chapters.chapter[harness.chapterKey].load() }

        assertEquals(1, harness.chapterApi.reads)
    }

    @Test
    fun aWriteThatCancelsTheChaptersReadStillLeadsToTheNextLesson() {
        val gate = CompletableDeferred<Unit>()
        harness.chapterApi.gate = gate
        play(listOf(checkStep("quiz")))

        tap("Right")
        tap("Check")
        tap("Continue")
        rule.waitUntil { harness.chapterApi.reads == 1 }
        rule.runOnIdle { harness.cache.invalidate(setOf(DataDomain.UserSubscription)) }
        gate.complete(Unit)

        rule.onNodeWithText("Next lesson").assertIsDisplayed()
    }

    @Test
    fun theLessonsEndWaitsForWhereItLeadsBeforeItsButtonWorks() {
        val gate = CompletableDeferred<Unit>()
        harness.chapterApi.gate = gate
        play(listOf(checkStep("quiz")))

        tap("Right")
        tap("Check")
        tap("Continue")
        rule.waitForIdle()
        rule.onNodeWithText("Continue").assertIsNotEnabled()

        gate.complete(Unit)
        rule.onNodeWithText("Next lesson").assertIsDisplayed()
    }

    @Test
    fun aLessonNeedingAScreenTheAppCantShowYetSaysSoInsteadOfOpening() {
        play(listOf(explanationStep("idea"), activityStep(BLANK_ID, INTERACTION_ACTIVITY_CHECK), summaryStep("end")))

        rule.onNodeWithText("This lesson isn't in the app yet").assertIsDisplayed()
        tap("Back")
        assertEquals(1, closed)
    }

    @Test
    fun aScreenTheLessonCanDoWithoutIsLeftOut() {
        play(listOf(explanationStep("idea"), activityStep(BLANK_ID, INTERACTION_ACTIVITY_CHECK), summaryStep("end"))) {
            optionalStepIds =
                """["$BLANK_ID"]"""
        }

        tap("Next")
        rule.onNodeWithText("One idea.").assertIsDisplayed()
    }

    @Test
    fun anAnswerTheAppNeverSentGoesOutWhenTheLessonOpensAgain() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()

        openAgain()
        rule.waitUntil { api.checks.size == 2 }

        assertEquals(
            1,
            api.checks
                .map { it.second.attemptId }
                .distinct()
                .size,
        )
    }

    @Test
    fun leavingWithAnUncheckedWrittenAnswerAsksFirst() {
        play(listOf(typedAnswerStep("why")))

        rule.onNode(hasSetTextAction()).performTextInput("Because")
        rule.waitForIdle()
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }

        rule.onNodeWithText("Leave for now?").assertIsDisplayed()
        tap("Keep writing")
        assertEquals(0, closed)
    }
}

private const val BLANK_ID = "00000000-0000-4000-8000-0000000000ee"
