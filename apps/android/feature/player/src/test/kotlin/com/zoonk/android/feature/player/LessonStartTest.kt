package com.zoonk.android.feature.player

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.GOAL
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.step
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LibraryLessonStartInputOpening
import com.zoonk.api.models.StudyBlockOpening
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class LessonStartTest {
    @get:Rule val folder = TemporaryFolder()
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
    private var lesson = playable(listOf(explanationStep("first")))
    private val api = FakeLessonPlayerApi(LessonLoad.Ready(lesson))

    @Before fun main() = Dispatchers.setMain(dispatcher)

    @After fun reset() = Dispatchers.resetMain()

    private suspend fun TestScope.player(
        opening: String?,
        tapped: Boolean,
        saved: SavedStateHandle = SavedStateHandle(),
    ): LessonPlayerViewModel {
        val cache = AppCache(session, backgroundScope)
        val drafts = DraftStore(folder.newFolder(), backgroundScope, dispatcher)
        drafts.follow { DraftsChange("ana") }
        return LessonPlayerViewModel(
            lessonId = LESSON_ID,
            studySessionId = null,
            firstAnswer = null,
            opening = opening,
            tapped = tapped,
            store = LessonPlayerStore(api, cache),
            cache = cache,
            sessions = session,
            choices = TodayChoices(drafts),
            drafts = drafts,
            saved = saved,
        )
    }

    @Test fun aPendingServerCheckKeepsItsScreenWhenTheRunResumesElsewhere() =
        runTest(dispatcher) {
            val first = "00000000-0000-4000-8000-000000000101"
            val typed = "00000000-0000-4000-8000-000000000102"
            val quiz = "00000000-0000-4000-8000-000000000103"
            val last = "00000000-0000-4000-8000-000000000104"
            lesson = playable(listOf(explanationStep(first), typedAnswerStep(typed), checkStep(quiz), explanationStep(last)))
            api.load = LessonLoad.Ready(lesson)
            // The learner answered the typed screen in an earlier visit.
            api.runAnswers = "[${runAnswerJson(typed, true, answeredAt = EARLIER_SITTING)}]"
            api.startGate = CompletableDeferred()
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            vm.act()
            vm.dispatch(LessonAction.Continue)
            assertEquals(
                typed,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            vm.dispatch(LessonAction.SelectAnswer(typed, LessonAnswer.Typed("Because it maps chances.")))
            vm.check()
            assertEquals(LessonPhase.Checking, vm.state.value?.phase)

            api.startGate!!.complete(Unit)
            advanceUntilIdle()
            assertTrue(vm.state.value?.run is LessonRun.Started)
            assertEquals(
                "the checked screen stays",
                typed,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            assertEquals("the typed answer is graded", listOf(typed), api.checks.map { it.first })
        }

    @Test fun aLearnerWhoDidNothingIsResumedToTheirFurthestScreen() =
        runTest(dispatcher) {
            lesson = playable(listOf(checkStep(ONE), checkStep(TWO), explanationStep(LAST)))
            api.load = LessonLoad.Ready(lesson)
            api.runAnswers = answered(ONE, TWO)
            api.startGate = CompletableDeferred()
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                LAST,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
        }

    @Test fun continuingKeepsTheScreenWhenTheRunResumesElsewhere() =
        runTest(dispatcher) {
            lesson = playable(listOf(explanationStep(FIRST), checkStep(ONE), checkStep(TWO), explanationStep(LAST)))
            api.load = LessonLoad.Ready(lesson)
            api.runAnswers = answered(ONE, TWO)
            api.startGate = CompletableDeferred()
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            vm.act()
            vm.dispatch(LessonAction.Continue)
            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertTrue(vm.state.value?.run is LessonRun.Started)
            assertEquals(
                ONE,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
        }

    /** Code answering a screen on its own, such as a screen putting back what Android saved, isn't the learner acting. */
    @Test fun anAnswerSetWithoutTheLearnerDoesNotKeepTheScreen() =
        runTest(dispatcher) {
            lesson = playable(listOf(checkStep(ONE), checkStep(TWO), explanationStep(LAST)))
            api.load = LessonLoad.Ready(lesson)
            api.runAnswers = answered(ONE, TWO)
            api.startGate = CompletableDeferred()
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            vm.select(LessonAnswer.Check("wrong"))
            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                LAST,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
        }

    @Test fun aSpokenTakeKeepsItsScreenWhenTheRunResumesElsewhere() =
        runTest(dispatcher) {
            lesson = playable(listOf(spokenStep(ONE), explanationStep(LAST)))
            api.load = LessonLoad.Ready(lesson)
            api.runAnswers = answered(ONE)
            api.startGate = CompletableDeferred()
            api.spokenGrade = {
                ApiJson.decodeFromString(
                    com.zoonk.api.models.SpokenAnswerGrade
                        .serializer(),
                    """{"attemptId":"00000000-0000-4000-8000-000000000021","explanation":null,"isCorrect":true,"score":1,
                        "transcript":"Tengo hambre","words":[],"wordsToPractice":[]}""",
                )
            }
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            vm.act()
            val grading =
                async {
                    vm.gradeSpoken(
                        ONE,
                        com.zoonk.android.feature.audio
                            .VoiceRecording(ByteArray(8), 1200),
                    )
                }
            runCurrent()
            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                com.zoonk.android.feature.audio.GradeOutcome
                    .Graded(Unit),
                grading.await(),
            )
            assertEquals(
                ONE,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            assertEquals(LessonPhase.Feedback, vm.state.value?.phase)
        }

    /** Android closed the app in the background, then the learner typed and cleared answers before the run started. */
    @Test fun whatTheLearnerEnteredBeforeTheRunWinsOverRestoredWork() =
        runTest(dispatcher) {
            lesson = playable(listOf(typedAnswerStep(ONE), typedAnswerStep(TWO), explanationStep(LAST)))
            api.load = LessonLoad.Ready(lesson)
            api.startGate = CompletableDeferred()
            val old = ApiJson.encodeToString(LessonAnswer.serializer(), LessonAnswer.Typed("An older draft"))
            val saved = SavedStateHandle(mapOf("answers" to hashMapOf(ONE to old, TWO to old)))
            val vm = player(null, tapped = true, saved = saved)
            vm.open(lesson)
            runCurrent()

            vm.dispatch(LessonAction.SelectAnswer(ONE, LessonAnswer.Typed("What I typed now")))
            vm.dispatch(LessonAction.SelectAnswer(TWO, LessonAnswer.Typed("Typed, then cleared")))
            vm.dispatch(LessonAction.SelectAnswer(TWO, null))
            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            val answers =
                vm.state.value
                    ?.answers
                    .orEmpty()
            assertEquals(LessonAnswer.Typed("What I typed now"), answers[ONE])
            assertEquals(null, answers[TWO])
        }

    /** Android closed the app in the background: the typed draft comes back on its screen once the run places the learner. */
    @Test fun aRestoredDraftLandsOnItsScreenAfterTheResume() =
        runTest(dispatcher) {
            lesson = playable(listOf(typedAnswerStep(ONE), typedAnswerStep(TWO), explanationStep(LAST)))
            api.load = LessonLoad.Ready(lesson)
            api.runAnswers = answered(ONE)
            api.startGate = CompletableDeferred()
            val draft = LessonAnswer.Typed("Because the droplets are small")
            val saved = SavedStateHandle(mapOf("answers" to hashMapOf(TWO to ApiJson.encodeToString(LessonAnswer.serializer(), draft))))
            val vm = player(null, tapped = true, saved = saved)
            vm.open(lesson)
            runCurrent()

            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                TWO,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            assertEquals(
                draft,
                vm.state.value
                    ?.answers
                    ?.get(TWO),
            )
        }

    private fun answered(vararg stepIds: String) =
        stepIds.joinToString(",", "[", "]") { runAnswerJson(it, true, answeredAt = EARLIER_SITTING) }

    @Test fun aTypedAnswerSurvivesRetryingAFailedStartAfterCheck() = typedAnswerSurvivesRetryingStart(check = true)

    @Test fun anUncheckedTypedAnswerSurvivesRetryingAFailedStart() = typedAnswerSurvivesRetryingStart(check = false)

    private fun typedAnswerSurvivesRetryingStart(check: Boolean) =
        runTest(dispatcher) {
            val first = "00000000-0000-4000-8000-000000000101"
            val typed = "00000000-0000-4000-8000-000000000102"
            val last = "00000000-0000-4000-8000-000000000103"
            lesson = playable(listOf(explanationStep(first), typedAnswerStep(typed), explanationStep(last)))
            api.load = LessonLoad.Ready(lesson)
            api.runAnswers = "[${runAnswerJson(first, true, answeredAt = EARLIER_SITTING)}]"
            api.startGate = CompletableDeferred()
            api.startFailures = 1
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()
            vm.act()
            vm.dispatch(LessonAction.Continue)
            val answer = LessonAnswer.Typed("Because it maps chances.")
            vm.dispatch(LessonAction.SelectAnswer(typed, answer))
            if (check) vm.check()

            api.startGate!!.complete(Unit)
            advanceUntilIdle()
            assertTrue("start failed", vm.state.value?.run is LessonRun.Refused)
            assertEquals(LessonPhase.Playing, vm.state.value?.phase)

            vm.retryStart()
            advanceUntilIdle()

            assertTrue("retry started the run", vm.state.value?.run is LessonRun.Started)
            assertEquals(
                typed,
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            assertEquals(
                answer,
                vm.state.value
                    ?.answers
                    ?.get(typed),
            )
        }

    @Test fun deviceVerdictDoesNotWaitForAdmission() =
        runTest(dispatcher) {
            lesson = playable(listOf(checkStep("quiz"), explanationStep("next")))
            api.load = LessonLoad.Ready(lesson)
            api.startGate = CompletableDeferred()
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()
            vm.dispatch(
                com.zoonk.android.feature.player.engine.LessonAction.SelectAnswer(
                    "quiz",
                    com.zoonk.android.feature.player.model.LessonAnswer
                        .Check("right"),
                ),
            )
            vm.check()
            assertEquals(
                true,
                vm.state.value
                    ?.results
                    ?.get("quiz")
                    ?.isCorrect,
            )
            assertTrue(api.checks.isEmpty())
            vm.dispatch(com.zoonk.android.feature.player.engine.LessonAction.Continue)
            assertEquals(
                "next",
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            api.startGate!!.complete(Unit)
            advanceUntilIdle()
            assertEquals(1, api.checks.size)
            assertEquals(
                RUN_ID,
                api.checks
                    .single()
                    .second.runId
                    .toString(),
            )
        }

    @Test fun serverCheckShowsBusyWhileAdmissionIsPending() =
        runTest(dispatcher) {
            lesson = playable(listOf(typedAnswerStep("write")))
            api.load = LessonLoad.Ready(lesson)
            api.startGate = CompletableDeferred()
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()
            vm.dispatch(
                com.zoonk.android.feature.player.engine.LessonAction.SelectAnswer(
                    "write",
                    com.zoonk.android.feature.player.model.LessonAnswer
                        .Typed("Because"),
                ),
            )
            vm.check()
            assertEquals(com.zoonk.android.feature.player.engine.LessonPhase.Checking, vm.state.value?.phase)
            assertTrue(api.checks.isEmpty())
            api.startGate!!.complete(Unit)
            advanceUntilIdle()
            assertEquals(1, api.checks.size)
        }

    @Test fun spokenGradingShowsBusyAndWaitsForAdmission() =
        runTest(dispatcher) {
            lesson = playable(listOf(spokenStep("say")))
            api.load = LessonLoad.Ready(lesson)
            api.startGate = CompletableDeferred()
            var graded = false
            api.spokenGrade = {
                graded = true
                throw com.zoonk.android.data
                    .ApiException(com.zoonk.android.data.ApiError.Network)
            }
            val vm = player("""{"target":{"kind":"block","blockId":"00000000-0000-0000-0000-000000000001"}}""", tapped = false)
            vm.open(lesson)
            runCurrent()
            val grading =
                backgroundScope.launch {
                    vm.gradeSpoken(
                        "say",
                        com.zoonk.android.feature.audio
                            .VoiceRecording(ByteArray(8), 1200),
                    )
                }
            runCurrent()
            assertEquals(com.zoonk.android.feature.player.engine.LessonPhase.Checking, vm.state.value?.phase)
            assertTrue(!graded)
            assertEquals(1, api.startOpenings.size)
            api.startGate!!.complete(Unit)
            runCurrent()
            assertTrue(graded)
            assertTrue(grading.isCompleted)
        }

    @Test fun writtenStepsNavigateBeforeAdmissionAndStartWithTheirExactOpening() =
        runTest(dispatcher) {
            for (saved in listOf(true, false)) {
                val study = FakeStudyApi()
                val shown = step(0).copy(opensInPlayer = true)
                val opener = StudyOpener(study, study::writeLesson, AppCache(session, backgroundScope)) { "UTC" }
                val result = opener.open(day(listOf(shown), saved = saved), shown, next = true, goalId = GOAL)
                val route = (result as MutationResult.Done).value as AppRoute.Lesson
                assertTrue(study.targets.isEmpty())
                assertTrue(study.opened.isEmpty())
                api.startGate = CompletableDeferred()
                val vm = player(route.opening, tapped = true)
                vm.open(lesson)
                runCurrent()
                assertNotNull(vm.state.value?.currentStep)
                assertTrue(vm.state.value?.run is LessonRun.Idle)
                val expected = ApiJson.decodeFromString(LibraryLessonStartInputOpening.serializer(), route.opening!!)
                assertEquals(expected, api.startOpenings.last())
                api.startGate!!.complete(Unit)
                advanceUntilIdle()
                assertTrue(vm.state.value?.run is LessonRun.Started)
            }
        }

    @Test fun restoredStartWaitsAndOpenedReturnsToToday() =
        runTest(dispatcher) {
            val opening = """{"target":{"kind":"block","blockId":"00000000-0000-0000-0000-000000000001"}}"""
            api.opened = ApiJson.decodeFromString(StudyBlockOpening.serializer(), """{"kind":"today"}""")
            val vm = player(opening, tapped = false)
            vm.open(lesson)
            runCurrent()
            assertNotNull(vm.state.value?.currentStep)
            assertTrue(api.startOpenings.isEmpty())
            vm.dispatch(com.zoonk.android.feature.player.engine.LessonAction.Continue)
            advanceUntilIdle()
            assertEquals(AppRoute.Today, vm.redirect.value)
            assertTrue(vm.state.value?.run !is LessonRun.Started)
            assertEquals(1, api.startOpenings.size)
        }

    @Test fun aRetryableStartRetriesTheSameOpeningOnce() =
        runTest(dispatcher) {
            val opening = """{"target":{"kind":"block","blockId":"00000000-0000-0000-0000-000000000001"}}"""
            api.retryableStarts = 2
            val vm = player(opening, tapped = true)
            vm.open(lesson)
            advanceUntilIdle()
            assertEquals(2, api.startOpenings.size)
            assertEquals(api.startOpenings.first(), api.startOpenings.last())
            assertTrue(vm.state.value?.run is LessonRun.Refused)
        }

    @Test fun aDeviceVerdictHeldThroughAFailedStartIsRecordedAfterTryAgain() =
        runTest(dispatcher) {
            api.startGate = CompletableDeferred()
            api.startFailures = 1
            lesson = playable(listOf(checkStep("quiz"), explanationStep("next"), explanationStep("last")))
            api.load = LessonLoad.Ready(lesson)
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            vm.act()
            vm.dispatch(LessonAction.SelectAnswer("quiz", LessonAnswer.Check("right")))
            vm.check()
            assertEquals(
                true,
                vm.state.value
                    ?.results
                    ?.get("quiz")
                    ?.isCorrect,
            )
            vm.dispatch(LessonAction.Continue)
            assertEquals(
                "next",
                vm.state.value
                    ?.currentStep
                    ?.id,
            )

            api.startGate!!.complete(Unit)
            advanceUntilIdle()
            assertTrue("start failed", vm.state.value?.run is LessonRun.Refused)

            vm.retryStart()
            advanceUntilIdle()
            assertTrue("retry started the run", vm.state.value?.run is LessonRun.Started)
            assertEquals(
                "the learner keeps their place past the answered screen",
                "next",
                vm.state.value
                    ?.currentStep
                    ?.id,
            )
            assertEquals("the held answer is recorded once the run exists", listOf("quiz"), api.checks.map { it.first })
        }

    @Test fun aDeviceVerdictHeldThroughAFailedStartBlocksNothingAtTheEnd() =
        runTest(dispatcher) {
            api.startGate = CompletableDeferred()
            api.startFailures = 1
            lesson = playable(listOf(checkStep("quiz"), explanationStep("next"), explanationStep("last")))
            api.load = LessonLoad.Ready(lesson)
            val vm = player(null, tapped = true)
            vm.open(lesson)
            runCurrent()

            vm.act()
            vm.dispatch(LessonAction.SelectAnswer("quiz", LessonAnswer.Check("right")))
            vm.check()
            vm.dispatch(LessonAction.Continue)
            api.startGate!!.complete(Unit)
            advanceUntilIdle()
            vm.retryStart()
            advanceUntilIdle()
            vm.dispatch(LessonAction.Continue)
            vm.dispatch(LessonAction.Continue)
            advanceUntilIdle()
            assertEquals(LessonPhase.Completed, vm.state.value?.phase)
            assertEquals("completion records the held answer", listOf("quiz"), api.checks.map { it.first })
        }

    private companion object {
        const val FIRST = "00000000-0000-4000-8000-000000000201"
        const val ONE = "00000000-0000-4000-8000-000000000202"
        const val TWO = "00000000-0000-4000-8000-000000000203"
        const val LAST = "00000000-0000-4000-8000-000000000204"
    }
}
