package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.pressKey
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.language.reading
import com.zoonk.android.feature.player.model.LessonLoad
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

    @Test
    fun aPracticedLearnerReadsTheExplanationBeforeTheCheckEvenWhenTheRunSaysQuestionFirst() {
        play(listOf(explanationStep("idea"), checkStep("quiz"))) { support = "\"questionFirst\"" }

        assertTrue(viewModel.state.value?.run is LessonRun.Started)
        assertEquals(listOf("idea", "quiz"), viewModel.state.value?.queue)
    }

    /** A lesson reopened after a plan change plays the screens read again, not the copy the app kept. */
    @Test
    fun aLessonReopenedAfterAPlanChangePlaysItsFreshScreens() {
        play(listOf(explanationStep("idea"), summaryStep("end")))
        api.load = LessonLoad.Ready(playable(listOf(explanationStep("idea"), typedAnswerStep("write"), summaryStep("end"))))
        harness.cache.invalidate(setOf(DataDomain.Goals))

        harness.viewModel = openAgain()
        rule.waitUntil { viewModel.state.value?.run is LessonRun.Started }

        assertEquals(
            listOf("idea", "write", "end"),
            viewModel.state.value
                ?.steps
                ?.keys
                ?.toList(),
        )
    }

    /** A start that fails shows at once, even while the lesson's read is slow to come back. */
    @Test
    fun aFailedStartShowsWithoutWaitingForTheLessonsRead() {
        play(listOf(explanationStep("idea"), summaryStep("end")))
        harness.cache.invalidate(setOf(DataDomain.Goals))
        api.lessonGate = CompletableDeferred()
        api.startFailures = 1

        harness.viewModel = openAgain()

        rule.waitUntil { viewModel.state.value?.run is LessonRun.Refused }
        api.lessonGate?.complete(Unit)
    }

    /** Android closing the app in the background keeps a typed answer the learner hasn't checked. */
    @Test
    fun aTypedAnswerComesBackAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(typedAnswerStep("write"), summaryStep("end")), restoration = restoration)
        rule.onNode(hasSetTextAction()).performTextInput("Because the droplets are small")

        harness.viewModel = openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNode(hasSetTextAction()).assert(hasText("Because the droplets are small"))
    }

    /** A start that fails when the app comes back keeps the saved work for the start that follows. */
    @Test
    fun aTypedAnswerSurvivesAFailedStartAfterAndroidClosesTheApp() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(typedAnswerStep("write"), summaryStep("end")), restoration = restoration)
        rule.onNode(hasSetTextAction()).performTextInput("Because the droplets are small")

        api.startFailures = 1
        harness.viewModel = openAgain()
        restoration.emulateSavedInstanceStateRestore()
        tap("Try again")

        rule.onNode(hasSetTextAction()).assert(hasText("Because the droplets are small"))
    }

    /** An answer whose check fails once Android has saved the screen comes back: the server never got it. */
    @Test
    fun anAnswerWhoseCheckFailsInTheBackgroundComesBackAfterAndroidClosesTheApp() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(typedAnswerStep("write"), summaryStep("end")), restoration = restoration)
        rule.onNode(hasSetTextAction()).performTextInput("Because the droplets are small")
        api.gate = CompletableDeferred()
        api.checkFailures = 1
        tap("Check")

        // Android saves the screen while the check is on its way, and the check fails before the app comes back.
        val saved = harness.saved
        harness.saved = SavedStateHandle(saved.keys().associateWith { saved.get<Any>(it) })
        api.gate?.complete(Unit)
        harness.viewModel = openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNode(hasSetTextAction()).assert(hasText("Because the droplets are small"))
    }

    /** Android closing the app in the background keeps a pick the learner hasn't checked, ready to check. */
    @Test
    fun aPickComesBackAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(checkStep("quiz"), summaryStep("end")), restoration = restoration)
        tap("Right")

        harness.viewModel = openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithText("Check").assertIsEnabled()
    }

    /** Android closing the app in the background keeps the steps of a worked example the learner has shown. */
    @Test
    fun aWorkedExamplesShownStepsComeBackAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(workedExampleStep("worked"), summaryStep("end")), restoration = restoration)
        tap("Show the next step")
        rule.onNodeWithText("Each part is 20", substring = true).assertExists()

        harness.viewModel = openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithText("Each part is 20", substring = true).assertExists()
    }

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
    fun aReopenedLessonsHeldAnswerShowsNoIndicatorWhenItsResendSucceeds() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        api.gate = CompletableDeferred()

        val reopened = openAgain()
        rule.waitUntil { api.checks.size == 2 }

        try {
            assertTrue(!reopened.hasUnsent)
        } finally {
            api.gate?.complete(Unit)
        }
        rule.waitUntil { reopened.state.value?.run is LessonRun.Started }
        assertTrue(!reopened.hasUnsent)
    }

    @Test
    fun aRunStartsAfterAHeldAnswerEvenWhenItsResendFails() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 2 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()

        val reopened = openAgain()
        rule.waitUntil(timeoutMillis = 5_000) { reopened.state.value?.run != null && reopened.state.value?.run !is LessonRun.Starting }

        assertTrue(reopened.state.value?.run is LessonRun.Started)
        assertTrue(reopened.hasUnsent)
        assertEquals(
            "end",
            reopened.state.value
                ?.currentStep
                ?.id,
        )
    }

    @Test
    fun continueSendsHeldAnswersBeforeTheLessonFinishes() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }
        tap("Right")
        tap("Check")
        rule.waitUntil { api.checks.size == 1 }
        rule.waitForIdle()

        tap("Continue")
        rule.waitUntil { api.checks.size == 2 }

        assertEquals(api.checks.first().second, api.checks.last().second)
        assertTrue(api.completions.isEmpty())
    }

    @Test
    fun theLessonFinishesOnlyOnceAnAnswerHeldDuringAnotherResendIsSaved() {
        var firstOffline = true
        var secondOffline = false
        play(listOf(checkStep("first"), checkStep("second"), summaryStep("end"))) {
            grade = { id, _ ->
                if (id == "first" && firstOffline) throw ApiException(ApiError.Network)
                if (id == "second" && secondOffline) throw ApiException(ApiError.Network)
                checkResult(isCorrect = true)
            }
        }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()

        firstOffline = false
        secondOffline = true
        api.gate = CompletableDeferred()
        rule.runOnIdle { viewModel.resendAnswers() }

        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        api.gate?.complete(Unit)
        rule.waitForIdle()

        assertTrue("second's answer is still held", viewModel.hasUnsent)
        assertEquals("completion must wait for every held answer", emptyList<String>(), api.completions)
    }

    @Test
    fun theFinishWaitsForAnAnswerHeldAfterContinueStartedAResend() {
        var firstOffline = true
        var secondOffline = false
        play(listOf(checkStep("first"), checkStep("second"), summaryStep("end"))) {
            grade = { id, _ ->
                if (id == "first" && firstOffline) throw ApiException(ApiError.Network)
                if (id == "second" && secondOffline) throw ApiException(ApiError.Network)
                checkResult(isCorrect = true)
            }
        }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        firstOffline = false
        secondOffline = true
        api.gate = CompletableDeferred()
        tap("Continue")
        rule.waitForIdle()
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        api.gate?.complete(Unit)
        rule.waitForIdle()

        assertTrue(viewModel.hasUnsent)
        assertEquals(emptyList<String>(), api.completions)
    }

    @Test
    fun theFinishWaitsForAHeldAnswerWithNoResendRunning() {
        var secondOffline = false
        play(listOf(checkStep("first"), checkStep("second"), summaryStep("end"))) {
            grade = { id, _ ->
                if (id == "second" && secondOffline) throw ApiException(ApiError.Network)
                checkResult(isCorrect = true)
            }
        }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        secondOffline = true
        api.gate = CompletableDeferred()
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        api.gate?.complete(Unit)
        rule.waitForIdle()

        assertTrue(viewModel.hasUnsent)
        assertEquals(emptyList<String>(), api.completions)
    }

    @Test
    fun aLostReplyMissResentAtReopenKeepsItsRetry() {
        val quiz = "00000000-0000-4000-8000-000000000101"
        val idea = "00000000-0000-4000-8000-000000000102"
        val next = "00000000-0000-4000-8000-000000000103"
        play(listOf(checkStep(quiz), explanationStep(idea), checkStep(next))) { checkFailures = 1 }
        tap("Wrong")
        tap("Check")
        rule.waitForIdle()

        api.runAnswers = """[{"answeredAt":"2026-10-28T10:01:00Z","isCorrect":false,"stepId":"$quiz"}]"""
        val reopened = openAgain()
        rule.waitUntil(timeoutMillis = 5_000) { reopened.state.value?.run is LessonRun.Started }

        assertTrue(!reopened.hasUnsent)
        assertEquals(listOf(quiz, idea, next, quiz), reopened.state.value?.queue)
    }

    @Test
    fun aSavedCheckSendsOtherScreensHeldAnswers() {
        var offline = true
        play(listOf(checkStep("first"), checkStep("second"), summaryStep("end"))) {
            grade = { id, _ ->
                if (id == "first" && offline) throw ApiException(ApiError.Network)
                checkResult(isCorrect = true)
            }
        }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        val attempts = api.checks.count { it.first == "first" }
        offline = false

        tap("Right")
        tap("Check")
        rule.waitUntil { api.checks.count { it.first == "first" } > attempts }

        assertEquals(
            1,
            api.checks
                .filter { it.first == "first" }
                .map { it.second.attemptId }
                .distinct()
                .size,
        )
    }

    @Test
    fun aServerGradedCheckSendsOtherScreensHeldAnswers() {
        var offline = true
        play(listOf(checkStep("first"), typedAnswerStep("write"), summaryStep("end"))) {
            grade = { id, _ ->
                if (id == "first" && offline) throw ApiException(ApiError.Network)
                checkResult(isCorrect = true)
            }
        }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        rule.waitForIdle()
        val attempts = api.checks.count { it.first == "first" }
        offline = false

        rule.onNode(hasSetTextAction()).performTextInput("Because the droplets are small")
        tap("Check")
        rule.waitUntil { api.checks.count { it.first == "first" } > attempts }

        assertEquals(
            1,
            api.checks
                .filter { it.first == "first" }
                .map { it.second.attemptId }
                .distinct()
                .size,
        )
    }

    @Test
    fun foregroundTriggersMergeAndSendHeldScreensInParallel() {
        play(listOf(checkStep("first"), checkStep("second"), summaryStep("end"))) {
            grade = { _, _ -> throw ApiException(ApiError.Network) }
        }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        tap("Continue")
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        val sent = api.checks.size
        api.gate = CompletableDeferred()
        api.grade = { _, _ -> checkResult(isCorrect = true) }

        rule.runOnIdle { repeat(3) { viewModel.resendAnswers() } }
        rule.waitUntil { api.checks.size == sent + 2 }
        assertEquals(
            setOf("first", "second"),
            api.checks
                .drop(sent)
                .map { it.first }
                .toSet(),
        )
        api.gate?.complete(Unit)
        rule.waitForIdle()

        assertEquals(sent + 2, api.checks.size)
        assertTrue(!viewModel.hasUnsent)
    }

    @Test
    fun aMissIsSentBeforeItsRetryAndItsFailureHoldsThatRetry() {
        var offline = true
        play(listOf(checkStep("quiz"), summaryStep("end"))) {
            grade = { _, _ ->
                if (offline) throw ApiException(ApiError.Network)
                checkResult(isCorrect = true)
            }
        }
        tap("Wrong")
        tap("Check")
        rule.waitForIdle()
        val miss = api.checks.first().second
        tap("Continue")
        tap("Next")
        tap("Right")
        tap("Check")
        rule.waitForIdle()

        assertEquals(listOf(miss.attemptId), api.checks.map { it.second.attemptId }.distinct())
        offline = false
        rule.runOnIdle { viewModel.resendAnswers() }
        rule.waitUntil { !viewModel.hasUnsent }

        assertEquals(miss, api.checks[api.checks.lastIndex - 1].second)
        assertTrue(
            miss.attemptId !=
                api.checks
                    .last()
                    .second.attemptId,
        )
    }

    @Test
    fun anotherLearnersHeldAnswersAreNeitherPlacedNorSent() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }
        tap("Right")
        tap("Check")
        rule.waitForIdle()
        session.session = AuthenticatedSession("bia", "token-b", "local-b")

        val reopened = openAgain()
        rule.waitUntil { reopened.state.value?.run is LessonRun.Started }

        assertEquals(
            "quiz",
            reopened.state.value
                ?.currentStep
                ?.id,
        )
        assertEquals(1, api.checks.size)
        assertTrue(!reopened.hasUnsent)
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

    /**
     * The screen's number keys sort the card in hand without focus in the canvas, a held key sorts one card, and two presses
     * in one frame sort two cards.
     */
    @Test
    fun numberKeysSortEachCardInTurn() {
        play(listOf(ActivityFixtures.step("categorize")))

        rule.onRoot().performKeyInput {
            pressKey(Key.Two, pressDurationMillis = 1_000)
            pressKey(Key.One)
        }

        rule.onNodeWithText("2 of 3 sorted").assertExists()
        rule.onNodeWithText("Burning wood").assertExists()
    }
}

private const val BLANK_ID = "00000000-0000-4000-8000-0000000000ee"
