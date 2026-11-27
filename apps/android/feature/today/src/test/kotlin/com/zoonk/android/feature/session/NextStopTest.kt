package com.zoonk.android.feature.session

import android.content.Context
import android.view.accessibility.AccessibilityManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LessonGenerationStatus
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockLesson
import com.zoonk.api.models.Today
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.IOException
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class NextStopTest {
    @get:Rule
    val rule = createComposeRule()

    private lateinit var inputMode: InputModeManager
    private lateinit var context: Context

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val signIn = FakeSession(ana)
    private val api = FakeStudyApi()
    private val practice = step(1, kind = StudyBlock.Kind.PRACTICE, screen = StudyBlock.Screen.SESSION, lessonId = null)
    private var shown by mutableStateOf(unwritten(LessonGenerationStatus.GENERATING))

    /** Answered in order, then [settled]. */
    private val answers = mutableListOf<() -> LessonReadiness.Status>()
    private var settled = LessonReadiness.Status.READY
    private var setAside = false
    private var warmUpId: UUID? = null
    private var readinessReads = 0

    private var readinessGate: CompletableDeferred<Unit>? = null

    private var lastAnswer: LessonReadiness.Status? = null

    /** Each day read in order; then the lesson as readiness last answered. */
    private val dayReadsShow = mutableListOf<(DayStep) -> DayStep>()
    private val written: (DayStep) -> DayStep = { it.copy(screen = StudyBlock.Screen.LESSON, lesson = null) }
    private val asLastAnswered: (DayStep) -> DayStep = { step ->
        when (val status = lastAnswer) {
            null, LessonReadiness.Status.READY -> written(step)
            else -> step.copy(lesson = StudyBlockLesson(setAside, LessonGenerationStatus.entries.first { it.value == status.value }))
        }
    }
    private val unchanged: (DayStep) -> DayStep = { it }
    private var dayReads = 0

    private var generations: GenerationSource =
        object : GenerationSource {
            override fun events(id: String): Flow<GenerationEvent> =
                flow {
                    emit(GenerationEvent(status = "completed", step = "planLesson"))
                    emit(GenerationEvent(status = "started", step = "writeLesson"))
                    awaitCancellation()
                }

            override suspend fun status(id: String) = Generation.Status.RUNNING
        }

    private fun unwritten(
        status: LessonGenerationStatus?,
        setAside: Boolean = false,
    ) = step(0, screen = StudyBlock.Screen.SESSION, lessonId = WRITTEN, lesson = status?.let { StudyBlockLesson(setAside, it) })

    private fun answer(vararg statuses: LessonReadiness.Status) {
        statuses.forEach { status -> answers += { status } }
    }

    private val cache = AppCache(signIn, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))

    private fun viewModel() =
        SessionViewModel(
            StudyOpener(api, api::writeLesson, cache, { "UTC" }),
            StudySessionStore(api, cache) { "UTC" },
            cache,
            readiness = { _, _ ->
                readinessGate?.await()
                readinessReads++
                val status = (answers.removeFirstOrNull()?.invoke() ?: settled).also { lastAnswer = it }
                LessonReadiness(
                    alternative = null,
                    generationId = "run-1".takeIf { status == LessonReadiness.Status.GENERATING },
                    kind = LessonReadiness.Kind.LESSON,
                    setAside = setAside,
                    status = status,
                    warmUpId = warmUpId,
                )
            },
            generations = { generations },
        )

    private fun show(
        onStop: (() -> Unit)? = null,
        alternative: DayStep? = null,
    ): () -> Unit {
        val viewModel = viewModel()
        var drawn by mutableIntStateOf(0)

        rule.setContent {
            ZoonkTheme {
                inputMode = LocalInputModeManager.current
                context = LocalContext.current
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
                            shown = (dayReadsShow.removeFirstOrNull() ?: asLastAnswered)(shown)
                        },
                        onStop = onStop,
                        navigator = rememberAppNavigator(),
                        warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, signIn),
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
        answer(LessonReadiness.Status.GENERATING)
        show()
        writeTheLesson()

        assertEquals(0, api.targets.size)
        assertEquals(0, api.opened.size)
        rule.onNodeWithText("Your lesson is ready.").assertExists()
        rule.onNodeWithText("Start").assertIsNotFocused()
    }

    @Test
    fun aLessonWrittenWhileATalkBackLearnerWaitedTakesTheirFocus() {
        answer(LessonReadiness.Status.GENERATING)
        show()
        rule.runOnIdle { shadowOf(context.getSystemService(AccessibilityManager::class.java)).setTouchExplorationEnabled(true) }
        writeTheLesson()

        rule.onNodeWithText("Start").assertIsFocused()
    }

    /** Keyboard mode always focuses something on the screen, so the ready lesson's Start doesn't take it. */
    @Test
    fun aLessonWrittenWhileAKeyboardLearnerWaitedKeepsTheirFocus() {
        answer(LessonReadiness.Status.GENERATING)
        show()
        rule.runOnIdle { assertTrue(inputMode.requestInputMode(InputMode.Keyboard)) }
        rule.onNodeWithContentDescription("Leave").assertIsFocused()
        writeTheLesson()

        rule.onNodeWithText("Start").assertIsNotFocused()
        rule.onNodeWithContentDescription("Leave").assertIsFocused()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aLessonBeingWrittenWaitsFromTheFirstFrame() {
        readinessGate = CompletableDeferred()
        show(alternative = practice)
        rule.waitForIdle()
        shot("next-stop-first-frame-writing", "session.next-stop.first-frame.writing")

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
        rule.onNodeWithText("Continue").assertDoesNotExist()
        assertEquals(0, readinessReads)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aLessonWhoseWritingFailedSaysSoFromTheFirstFrame() {
        readinessGate = CompletableDeferred()
        shown = unwritten(LessonGenerationStatus.FAILED)
        show(alternative = practice)
        rule.waitForIdle()
        shot("next-stop-first-frame-failed", "session.next-stop.first-frame.failed")

        rule.onNodeWithText("Something went wrong on our side").assertExists()
        rule.onNodeWithText("Try again").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
        rule.onNodeWithText("Play a quiz").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aLessonItsChecksSetAsideSaysWhyFromTheFirstFrame() {
        readinessGate = CompletableDeferred()
        shown = unwritten(LessonGenerationStatus.FAILED, setAside = true)
        show(alternative = practice)
        rule.waitForIdle()
        shot("next-stop-first-frame-set-aside", "session.next-stop.first-frame.set-aside")

        rule.onNodeWithText("This lesson isn't available").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        rule.onNodeWithText("Start").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aLessonNobodyAskedForOffersStartFromTheFirstFrame() {
        readinessGate = CompletableDeferred()
        shown = unwritten(LessonGenerationStatus.NOT_STARTED)
        show(alternative = practice)
        rule.waitForIdle()
        shot("next-stop-first-frame-ready", "session.next-stop.first-frame.not-started")

        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("Practice now").assertDoesNotExist()
        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertDoesNotExist()
    }

    @Test
    fun aDayNotOpenedYetSaysItsLessonFailedAndAsksTodayAgainOnceItsWritten() {
        val gate = CompletableDeferred<Unit>()
        readinessGate = gate
        settled = LessonReadiness.Status.GENERATING
        val lesson =
            step(
                0,
                screen = StudyBlock.Screen.SESSION,
                saved = false,
                lessonId = WRITTEN,
                lesson = StudyBlockLesson(false, LessonGenerationStatus.FAILED),
            )
        val unopened = day(steps = listOf(lesson, practice.copy(id = null)), saved = false).copy(alternativePosition = 1)
        val viewModel = viewModel()

        rule.setContent {
            ZoonkTheme {
                UnopenedDay(
                    viewModel = viewModel,
                    read = TodayRead.Day(decodeFixture<Today>("today"), unopened),
                    refreshToday = { dayReads++ },
                    navigator = rememberAppNavigator(),
                    warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, signIn),
                )
            }
        }
        rule.waitForIdle()

        rule.onNodeWithText("Something went wrong on our side").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()

        gate.complete(Unit)
        rule.waitForIdle()

        assertEquals(1, readinessReads)
        assertEquals(1, dayReads)
        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
    }

    @Test
    fun aDayFromAServerThatDoesntSayOffersNothingUntilReadinessAnswers() {
        val gate = CompletableDeferred<Unit>()
        readinessGate = gate
        settled = LessonReadiness.Status.GENERATING
        shown = unwritten(null)
        show(alternative = practice)
        rule.waitForIdle()

        rule.onNodeWithText("Start").assertDoesNotExist()
        rule.onNodeWithText("Practice now").assertDoesNotExist()
        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertDoesNotExist()

        gate.complete(Unit)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
    }

    @Test
    fun aLessonNobodyIsWritingOffersStartAndStopsAsking() {
        settled = LessonReadiness.Status.NOT_STARTED
        shown = unwritten(LessonGenerationStatus.NOT_STARTED)
        show()
        rule.mainClock.advanceTimeBy(11_000)
        rule.waitForIdle()

        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertDoesNotExist()
        assertEquals(1, readinessReads)
        assertEquals(0, dayReads)
    }

    @Test
    fun aLessonWhoseWriterStoppedSaysSoOnItsFirstReadinessAndReadsTheDayAgain() {
        settled = LessonReadiness.Status.FAILED
        dayReadsShow += unchanged
        show()
        rule.waitForIdle()

        rule.onNodeWithText("Something went wrong on our side").assertExists()
        rule.onNodeWithText("Try again").assertExists()
        assertEquals(1, dayReads)
    }

    @Test
    fun aLessonARunIsWritingWaitsOnTheNextStopByItsReadinessAlone() {
        answer(LessonReadiness.Status.GENERATING, LessonReadiness.Status.GENERATING)
        show(alternative = practice)
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
        assertEquals(0, dayReads)

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        assertEquals(3, readinessReads)
        assertEquals(1, dayReads)
    }

    @Test
    fun aReadTheServerCouldntAnswerKeepsTheWait() {
        answers += { throw ApiException(ApiError.Unavailable, "SERVICE_UNAVAILABLE", 503) }
        settled = LessonReadiness.Status.GENERATING
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        assertEquals(0, dayReads)
    }

    @Test
    fun aRunWhoseUpdatesStopKeepsTheWaitAndAsksReadinessAgain() {
        settled = LessonReadiness.Status.GENERATING
        generations =
            object : GenerationSource {
                override fun events(id: String): Flow<GenerationEvent> = flow { throw IOException("Offline") }

                override suspend fun status(id: String) = Generation.Status.RUNNING
            }
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Connection lost").assertDoesNotExist()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        assertTrue("read $readinessReads times", readinessReads >= 2)
    }

    @Test
    fun aGuessOnTheFirstLessonsWaitKeepsItsCardOnceTheLessonIsWritten() {
        warmUpId = UUID.fromString(WARM_UP_ID)
        answer(LessonReadiness.Status.GENERATING)
        show()
        rule.waitForIdle()
        rule.onNodeWithText("Play a quiz").performClick()
        rule.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()
        rule.onNodeWithText("Next guess").assertExists()

        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready").assertExists()
        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("Here's the answer").assertExists()
        rule.onNodeWithText("Next guess").assertDoesNotExist()
    }

    @Test
    fun aWrittenLessonTheDayHasntCaughtUpOnKeepsTheWaitUntilItDoes() {
        answer(LessonReadiness.Status.GENERATING)
        dayReadsShow += unchanged
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
        assertEquals(2, dayReads)
    }

    @Test
    fun anExpiredSignInEndsTheWait() {
        answer(LessonReadiness.Status.GENERATING)
        answers += { throw ApiException(ApiError.Unauthorized) }
        show()
        rule.mainClock.advanceTimeBy(16_000)
        rule.waitForIdle()

        assertEquals(listOf(ana), signIn.expired)
        assertEquals(2, readinessReads)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun theOtherStepIsNamedByWhatItStartsWhileTheLessonIsWrittenAndOnceItFailed() {
        answer(LessonReadiness.Status.GENERATING, LessonReadiness.Status.GENERATING, LessonReadiness.Status.FAILED)
        show(alternative = practice)
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()
        shot("next-stop-writing-phone", "session.lesson-wait.writing")

        rule.onNodeWithText("Practice now").assertExists()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()
        shot("next-stop-writing-failed-phone", "session.lesson-wait.failed")

        rule.onNodeWithText("Something went wrong on our side").assertExists()
        rule.onNodeWithText("Practice now").assertExists()
    }

    /** A review picture of the screen and its layout, written only on demand: `-Pzoonk.shots=<folder>`. */
    private fun shot(
        name: String,
        scenario: String,
    ) {
        val folder = System.getProperty("zoonk.shots").orEmpty().ifEmpty { return }
        writeRender(File(folder, "$name.png"), rule.onRoot().captureRender(scenario).asAndroidBitmap())
    }

    @Test
    fun aRunThatFailsSaysItDidntFinishInsteadOfOfferingStart() {
        answer(LessonReadiness.Status.GENERATING, LessonReadiness.Status.FAILED)
        show()
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Something went wrong on our side").assertExists()
        rule.onNodeWithText("Try again").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
        rule.onNodeWithText("Your lesson is ready.").assertDoesNotExist()
    }

    @Test
    fun aRunThatFailsOffersTryAgainAndNoQuiz() {
        warmUpId = UUID.fromString(WARM_UP_ID)
        settled = LessonReadiness.Status.FAILED
        shown = unwritten(LessonGenerationStatus.FAILED)
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("Try again").assertExists()
        rule.onNodeWithText("Play a quiz").assertDoesNotExist()
        rule.onNodeWithText("Back to quiz").assertDoesNotExist()
        rule.onNodeWithText("Next guess").assertDoesNotExist()
    }

    @Test
    fun aQuizOpenWhenTheRunFailsGoesWithIt() {
        warmUpId = UUID.fromString(WARM_UP_ID)
        settled = LessonReadiness.Status.GENERATING
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        rule.onNodeWithText("Play a quiz").performClick()
        rule.onNodeWithText(QUIZ_QUESTION).assertExists()

        settled = LessonReadiness.Status.FAILED
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        rule.onNodeWithText("Try again").assertExists()
        rule.onNodeWithText(QUIZ_QUESTION).assertDoesNotExist()
    }

    @Test
    fun aLessonItsChecksSetAsideSaysSoInsteadOfOfferingToTryAgain() {
        settled = LessonReadiness.Status.FAILED
        setAside = true
        show(alternative = practice)
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("This lesson isn't available").assertExists()
        rule.onNodeWithText("Something went wrong on our side").assertDoesNotExist()
        rule.onNodeWithText("Try again").assertDoesNotExist()

        rule.mainClock.advanceTimeBy(10_000)
        rule.waitForIdle()

        assertEquals(1, readinessReads)
    }

    @Test
    fun aSlowRunStillWritingAfterTenMinutesKeepsItsWait() {
        settled = LessonReadiness.Status.GENERATING
        show()
        rule.mainClock.advanceTimeBy(601_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()
        rule.onNodeWithText("Something went wrong on our side").assertDoesNotExist()
        rule.onNodeWithText("Try again").assertDoesNotExist()
    }

    @Test
    fun aFailedLessonWrittenAgainElsewhereIsFollowedAndOffered() {
        answer(LessonReadiness.Status.FAILED, LessonReadiness.Status.GENERATING)
        shown = unwritten(LessonGenerationStatus.FAILED)
        dayReadsShow += unchanged
        show()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()

        rule.onNodeWithText("Something went wrong on our side").assertExists()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is usually ready in a few minutes.").assertExists()

        rule.mainClock.advanceTimeBy(5_000)
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertExists()
    }

    @Test
    fun workTappedWhileWaitingIsNeverDrawnAsTheReadyLesson() {
        settled = LessonReadiness.Status.GENERATING
        show(alternative = practice)
        rule.onNodeWithText("Practice now").performClick()
        rule.waitForIdle()
        shown = practice
        rule.waitForIdle()

        rule.onNodeWithText("Your lesson is ready.").assertDoesNotExist()
    }

    private companion object {
        const val QUIZ_QUESTION = "Why do beekeepers puff smoke into a hive before opening it?"

        val WRITTEN: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f00")
    }
}
