package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.requestFocus
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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

    /** Readiness answers in order, then ready; null answers that the sign-in expired. */
    private val statuses = mutableListOf<LessonReadiness.Status?>()
    private var readinessReads = 0
    private var dayReads = 0
    private var dayShowsTheLessonWritten = true
    private var staleDayReads = 0

    /** A step whose lesson the plan hasn't picked yet, as the API sends it; returns a way to draw the screen anew. */
    private fun show(
        onStop: (() -> Unit)? = null,
        alternative: DayStep? = null,
    ): () -> Unit {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(signIn, scope)
        val viewModel =
            SessionViewModel(
                StudyOpener(api, api::writeLesson, cache, { "UTC" }, scope),
                StudySessionStore(api, cache) { "UTC" },
                { _, milliseconds -> waits += milliseconds },
                cache,
                readiness = { _, _ ->
                    readinessReads++
                    val status = if (statuses.isEmpty()) LessonReadiness.Status.READY else statuses.removeAt(0)
                    LessonReadiness(
                        alternative = null,
                        generationId = "run-1",
                        status = status ?: throw ApiException(ApiError.Unauthorized),
                    )
                },
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
                        notWritten = null,
                        alternative = alternative,
                        refresh = {
                            dayReads++
                            if (dayShowsTheLessonWritten && dayReads > staleDayReads) {
                                shown = shown.copy(lessonId = shown.lessonId ?: WRITTEN, screen = StudyBlock.Screen.LESSON)
                            }
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

        assertEquals(emptyList<UUID>(), api.started)
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

        rule.onNodeWithText("Getting it ready…").assertExists()
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
        staleDayReads = 1
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Getting it ready…").assertExists()
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
    fun aRunThatFailsOffersStartAgainWithoutSayingTheLessonIsReady() {
        statuses += listOf(LessonReadiness.Status.GENERATING, LessonReadiness.Status.FAILED)
        dayShowsTheLessonWritten = false
        shown = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN)
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("Your lesson is ready.").assertDoesNotExist()
        assertEquals(1, dayReads)
        assertEquals(0, waits.size)
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
