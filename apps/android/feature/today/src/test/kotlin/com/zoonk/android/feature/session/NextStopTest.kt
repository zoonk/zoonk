package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.requestFocus
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class NextStopTest {
    @get:Rule
    val rule = createComposeRule()

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val signIn = FakeSession(ana)
    private val api = FakeStudyApi()
    private val waits = mutableListOf<Long>()
    private val waiting = step(0, screen = StudyBlock.Screen.SESSION, lessonId = null)
    private val practice = step(1, kind = StudyBlock.Kind.PRACTICE, screen = StudyBlock.Screen.SESSION, lessonId = null)
    private var shown by mutableStateOf(waiting)

    /** Readiness answers in order, then [settled]; null answers that the sign-in expired. */
    private val statuses = mutableListOf<LessonReadiness.Status?>()
    private var settled = LessonReadiness.Status.READY
    private var setAside = false
    private var readinessReads = 0

    /** What each read of the day shows of the step, in order; then its lesson written. */
    private val dayReadsShow = mutableListOf<(DayStep) -> DayStep>()
    private val written: (DayStep) -> DayStep = { it.copy(lessonId = it.lessonId ?: WRITTEN, screen = StudyBlock.Screen.LESSON) }
    private val unchanged: (DayStep) -> DayStep = { it }
    private val picked: (DayStep) -> DayStep = { it.copy(lessonId = WRITTEN) }
    private var dayReads = 0

    private val generations =
        object : GenerationSource {
            override fun events(id: String): Flow<GenerationEvent> =
                flow {
                    emit(GenerationEvent(status = "completed", step = "planLesson"))
                    emit(GenerationEvent(status = "started", step = "writeLesson"))
                    awaitCancellation()
                }

            override suspend fun status(id: String) = Generation.Status.RUNNING
        }

    /** A step whose lesson the plan hasn't picked yet, as the API sends it; returns a way to draw the screen anew. */
    private fun show(
        asked: Boolean = true,
        onStop: (() -> Unit)? = null,
        alternative: DayStep? = null,
    ): () -> Unit {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(signIn, scope)
        val viewModel =
            SessionViewModel(
                StudyOpener(api, api::writeLesson, cache, { "UTC" }),
                StudySessionStore(api, cache) { "UTC" },
                { _, milliseconds -> waits += milliseconds },
                cache,
                readiness = { _, _ ->
                    readinessReads++
                    val status = if (statuses.isEmpty()) settled else statuses.removeAt(0)
                    LessonReadiness(
                        alternative = null,
                        generationId = "run-1",
                        setAside = setAside,
                        status = status ?: throw ApiException(ApiError.Unauthorized),
                    )
                },
                generations = { generations },
                now = { rule.mainClock.currentTime },
            )
        var drawn by mutableIntStateOf(0)

        rule.setContent {
            ZoonkTheme {
                key(drawn) {
                    NextStop(
                        viewModel = viewModel,
                        day = day(steps = listOf(shown)),
                        step = shown,
                        goalId = GOAL,
                        asked = asked,
                        notWritten = null,
                        alternative = alternative,
                        refresh = {
                            dayReads++
                            shown = (dayReadsShow.removeFirstOrNull() ?: written)(shown)
                        },
                        onStop = onStop,
                        navigator = rememberAppNavigator(),
                    )
                }
            }
        }
        return { drawn++ }
    }

    private fun writeTheLesson() {
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()
    }

    @Test
    fun aLessonWrittenWhileTheLearnerWaitedIsOfferedNotOpened() {
        show()
        writeTheLesson()

        assertEquals(0, api.targets.size)
        assertEquals(0, api.opened.size)
        rule.onNodeWithText("Your lesson is ready.").assertExists()
        rule.onNodeWithText("Start").assertIsFocused()
        assertEquals(1, waits.size)
    }

    @Test
    fun aLessonARunIsWritingWaitsOnTheNextStopByItsReadinessAlone() {
        statuses += listOf(LessonReadiness.Status.GENERATING, LessonReadiness.Status.GENERATING)
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show(alternative = practice)
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("This lesson is being written for you. It's usually ready in about two minutes.").assertExists()
        rule.onNodeWithText("While you wait: Mixed practice").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
        assertEquals(0, dayReads)

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        assertEquals(3, readinessReads)
        assertEquals(1, dayReads)
        assertEquals(1, waits.size)
    }

    @Test
    fun aWrittenLessonTheDayHasntCaughtUpOnKeepsTheWaitUntilItDoes() {
        statuses += LessonReadiness.Status.GENERATING
        dayReadsShow += unchanged
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("This lesson is being written for you. It's usually ready in about two minutes.").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        assertEquals(2, dayReads)
        assertEquals(1, waits.size)
    }

    @Test
    fun anExpiredSignInEndsTheWait() {
        statuses += listOf(LessonReadiness.Status.GENERATING, null)
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(16_000)
        rule.waitForIdle()

        assertEquals(listOf(ana), signIn.expired)
        assertEquals(2, readinessReads)
    }

    @Test
    fun aRunThatFailsSaysItDidntFinishInsteadOfOfferingStart() {
        statuses += listOf(LessonReadiness.Status.GENERATING, LessonReadiness.Status.FAILED)
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("This didn't finish").assertExists()
        rule.onNodeWithText("Try again").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
        rule.onNodeWithText("Your lesson is ready.").assertDoesNotExist()
        assertEquals(0, waits.size)
    }

    @Test
    fun aLessonItsChecksSetAsideSaysSoInsteadOfOfferingToTryAgain() {
        settled = LessonReadiness.Status.FAILED
        setAside = true
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show(alternative = practice)
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("This lesson isn't available").assertExists()
        rule.onNodeWithText("This didn't finish").assertDoesNotExist()
        rule.onNodeWithText("Try again").assertDoesNotExist()

        rule.mainClock.advanceTimeBy(10_000)
        rule.waitForIdle()

        assertEquals(1, readinessReads)
    }

    @Test
    fun aLessonARunIsWritingShowsTheRunsPhasesAndWhatItTakes() {
        settled = LessonReadiness.Status.GENERATING
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule
            .onNodeWithContentDescription("Writing the lesson")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "in progress"))
        rule.onNodeWithText("This lesson is being written for you. It's usually ready in about two minutes.").assertExists()
    }

    @Test
    fun aRunStillWritingAfterFiveMinutesSaysItDidntFinish() {
        settled = LessonReadiness.Status.GENERATING
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(301_000)
        rule.waitForIdle()

        rule.onNodeWithText("This didn't finish").assertExists()
        rule.onNodeWithText("Try again").assertExists()
    }

    @Test
    fun aFailedLessonWrittenAgainElsewhereIsFollowedAndOffered() {
        statuses += listOf(LessonReadiness.Status.FAILED, LessonReadiness.Status.GENERATING)
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("This didn't finish").assertExists()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("This lesson is being written for you. It's usually ready in about two minutes.").assertExists()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
    }

    @Test
    fun aWaitDrawnAnewKeepsItsDeadline() {
        dayReadsShow += List(10) { unchanged }
        val drawAnew = show()
        rule.mainClock.advanceTimeBy(15_000)
        drawAnew()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("This didn't start").assertExists()
    }

    @Test
    fun aStuckWaitKeepsItsNoticeWhenTheScreenIsDrawnAnew() {
        dayReadsShow += List(10) { unchanged }
        val drawAnew = show()
        rule.mainClock.advanceTimeBy(21_000)
        rule.waitForIdle()
        drawAnew()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("This didn't start").assertExists()
    }

    @Test
    fun aStepTheLearnerAskedForThatDoesntStartSaysSoAfterTwentySeconds() {
        dayReadsShow += List(10) { unchanged }
        show()
        rule.mainClock.advanceTimeBy(21_000)
        rule.waitForIdle()

        rule.onNodeWithText("This didn't start").assertExists()
        rule.onNodeWithText("Try again").assertExists()
    }

    @Test
    fun aPickedLessonThatHasntStartedKeepsTheWaitTheLearnerAskedFor() {
        statuses += listOf(LessonReadiness.Status.NOT_STARTED, LessonReadiness.Status.GENERATING)
        dayReadsShow += picked
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("This lesson is being written for you. It's usually ready in about two minutes.").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()

        rule.mainClock.advanceTimeBy(10_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        assertEquals(1, waits.size)
    }

    @Test
    fun aStepWithoutItsLessonTheLearnerDidntAskForOffersStart() {
        show(asked = false)
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("This lesson is being written for you. It's usually ready in about two minutes.").assertDoesNotExist()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        assertEquals(0, dayReads)
    }

    @Test
    fun theReadyLessonLeavesFocusWhereTheLearnerPutIt() {
        show(onStop = {})
        rule.onNodeWithText("Stop for today").requestFocus()
        writeTheLesson()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        rule.onNodeWithText("Stop for today").assertIsFocused()
        rule.onNodeWithText("Start").assertIsNotFocused()
    }

    @Test
    fun workTappedWhileWaitingIsNeverDrawnAsTheReadyLesson() {
        show(alternative = practice)
        rule.onNodeWithText("While you wait: Mixed practice").performClick()
        rule.waitForIdle()
        shown = practice
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertDoesNotExist()
        assertEquals(0, waits.size)
    }

    @Test
    fun theReadyLessonStillTakesFocusWhenTheScreenIsDrawnAnew() {
        val drawAnew = show()
        writeTheLesson()
        drawAnew()
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        rule.onNodeWithText("Start").assertIsFocused()
        assertEquals(1, waits.size)
    }

    private companion object {
        val WRITTEN: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f00")
    }
}
