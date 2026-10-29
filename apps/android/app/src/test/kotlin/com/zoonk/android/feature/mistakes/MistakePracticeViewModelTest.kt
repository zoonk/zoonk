package com.zoonk.android.feature.mistakes

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.DrillStage
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.Segment
import com.zoonk.android.feature.practice.segments
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.api.models.MistakePatternPracticeResultReached
import com.zoonk.api.models.MistakePatternPracticeResultReachedLevel
import com.zoonk.api.models.MistakePracticeFeedbackReached
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class MistakePracticeViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private val twoMistakes =
        practice(
            practiceEntry(FIRST_MISTAKE, practiceQuestion(FIRST)),
            practiceEntry(SECOND_MISTAKE, practiceQuestion(SECOND, "question" to "Which is a star?")),
        )

    private fun TestScope.viewModel(
        api: FakeMistakesApi,
        clock: () -> Long = { 0L },
    ) = practiceViewModel(AppCache(session, CoroutineScope(SupervisorJob() + dispatcher)), api, clock)

    private suspend fun TestScope.started(viewModel: MistakePracticeViewModel): PracticeState {
        viewModel.practice.load()
        advanceUntilIdle()
        viewModel.begin((viewModel.practice.state.value as LoadState.Loaded).value)
        return requireNotNull(viewModel.state.value)
    }

    private val MistakePracticeViewModel.now get() = requireNotNull(state.value)

    private fun MistakePracticeViewModel.answer(answer: Answer = Answer.Choice(0)) {
        val shown = now
        submit(shown.read.questions[shown.run.index], answer)
    }

    @Test
    fun eachAnswerCarriesTheRunsEarlierOnesAndTheEndCountsThemAll() =
        runTest(dispatcher) {
            val api = FakeMistakesApi(twoMistakes)
            api.answer = { practiceFeedback(answerId = if (it.itemId.toString() == FIRST) FIRST_ANSWER else SECOND_ANSWER) }
            val viewModel = viewModel(api)
            val read = started(viewModel).read

            viewModel.answer()
            advanceUntilIdle()
            viewModel.next(read.questions)
            viewModel.answer()
            advanceUntilIdle()
            viewModel.next(read.questions)
            advanceUntilIdle()

            assertEquals(listOf(emptyList(), listOf(UUID.fromString(FIRST_ANSWER))), api.answers.map { it.run?.answerIds })
            assertEquals(listOf(FIRST_ANSWER, SECOND_ANSWER).map(UUID::fromString), api.finishes.single().answerIds)
            assertEquals(true, api.finishes.single().ended)
            assertEquals(completion(), viewModel.now.end?.summary)
        }

    @Test
    fun theEndKeepsTheLaterLevelAndTheHigherEnergyItsAnswersReached() =
        runTest(dispatcher) {
            val yellow = MistakePatternPracticeResultReachedLevel(MistakePatternPracticeResultReachedLevel.Color.YELLOW, 3)
            val api = FakeMistakesApi(twoMistakes)
            val reached = mutableListOf(MistakePracticeFeedbackReached(energy = 62, level = yellow), MistakePracticeFeedbackReached(58, null))
            api.answer = { practiceFeedback().copy(reached = reached.removeAt(0)) }
            api.finish = { completion().copy(reached = MistakePatternPracticeResultReached(energy = 60, level = null)) }
            val viewModel = viewModel(api)
            val read = started(viewModel).read

            viewModel.answer()
            advanceUntilIdle()
            viewModel.next(read.questions)
            viewModel.answer()
            advanceUntilIdle()
            viewModel.next(read.questions)
            advanceUntilIdle()

            assertEquals(ReachedFacts(level = yellow, energy = 62), viewModel.now.reached)
        }

    @Test
    fun theRunKeepsItsQuestionsWhenAnAnswerRefreshesThePractice() =
        runTest(dispatcher) {
            val api = FakeMistakesApi(twoMistakes)
            val viewModel = viewModel(api)
            started(viewModel)

            viewModel.answer()
            advanceUntilIdle()
            api.read = practice()
            viewModel.practice.refresh()
            advanceUntilIdle()

            assertEquals(
                listOf(FIRST, SECOND),
                viewModel.now.read.questions
                    .map { it.itemId },
            )
        }

    @Test
    fun anAnswerSentAgainKeepsItsAttempt() =
        runTest(dispatcher) {
            val api = FakeMistakesApi(twoMistakes)
            api.answer = { throw ApiException(ApiError.Network) }
            val viewModel = viewModel(api)
            started(viewModel)

            viewModel.answer(Answer.Choice(1))
            advanceUntilIdle()
            assertEquals(RunPhase.AnswerFailed, viewModel.now.run.phase)
            api.answer = { practiceFeedback() }
            viewModel.retry()
            advanceUntilIdle()

            assertEquals(
                1,
                api.answers
                    .map { it.attemptId }
                    .distinct()
                    .size,
            )
            assertEquals(2, api.answers.size)
            assertEquals(api.answers[0].answer, api.answers[1].answer)
            assertEquals(true, viewModel.now.run.phase is RunPhase.Checked)
        }

    @Test
    fun anHonestDontKnowIsNeitherRightNorWrongButTheClockRunningOutIsAMiss() =
        runTest(dispatcher) {
            val api =
                FakeMistakesApi(
                    practice(
                        practiceEntry(FIRST_MISTAKE, practiceQuestion(FIRST), drill = drill("timed", seconds = 30)),
                        practiceEntry(SECOND_MISTAKE, practiceQuestion(SECOND)),
                    ),
                )
            api.answer = { practiceFeedback(isCorrect = false) }
            val viewModel = viewModel(api)
            val read = started(viewModel).read

            viewModel.timeUp(read.questions[0], seconds = 30)
            advanceUntilIdle()
            viewModel.next(read.questions)
            viewModel.answer(Answer.DontKnow)
            advanceUntilIdle()

            assertEquals(30_000L, api.answers[0].durationMs)
            assertEquals(listOf(Segment.Wrong, Segment.Read), segments(read.questions, viewModel.now.run))
        }

    @Test
    fun aMistakeCountsAsFixedOnceAndALaterMissOpensItAgain() =
        runTest(dispatcher) {
            val api =
                FakeMistakesApi(
                    practice(
                        practiceEntry(
                            FIRST_MISTAKE,
                            practiceQuestion(FIRST),
                            practiceQuestion(
                                SECOND,
                                "question" to "Which orbits the Sun?",
                            ),
                        ),
                    ),
                )
            val viewModel = viewModel(api)
            val read = started(viewModel).read

            api.answer = { practiceFeedback(fixed = true, fixedMistakeIds = listOf(FIRST_MISTAKE, OTHER_MISTAKE)) }
            viewModel.answer()
            advanceUntilIdle()
            assertEquals(setOf(FIRST_MISTAKE, OTHER_MISTAKE), viewModel.now.fixedIds)

            api.answer = { practiceFeedback(isCorrect = false) }
            viewModel.next(read.questions)
            viewModel.answer(Answer.Choice(1))
            advanceUntilIdle()

            assertEquals(setOf(OTHER_MISTAKE), viewModel.now.fixedIds)
        }

    @Test
    fun endingEarlyCountsWhatWasAnsweredEvenWhenTheCountFails() =
        runTest(dispatcher) {
            val api = FakeMistakesApi(twoMistakes)
            api.answer = { practiceFeedback(answerId = FIRST_ANSWER) }
            api.finish = { throw ApiException(ApiError.Network) }
            val viewModel = viewModel(api)
            started(viewModel)

            viewModel.answer()
            advanceUntilIdle()
            viewModel.leave()
            viewModel.leave()
            advanceUntilIdle()

            assertEquals(listOf(listOf(UUID.fromString(FIRST_ANSWER))), api.finishes.map { it.answerIds })
            assertEquals(RunPhase.Finishing, viewModel.now.run.phase)
            assertNull(requireNotNull(viewModel.now.end).summary)
        }

    @Test
    fun oneItemAskedUnderTwoMistakesIsTwoAnswers() =
        runTest(dispatcher) {
            val planet = practiceQuestion(FIRST)
            val star = practiceQuestion(SECOND, "question" to "Which is a star?")
            val api =
                FakeMistakesApi(
                    practice(
                        practiceEntry(FIRST_MISTAKE, planet, star),
                        practiceEntry(SECOND_MISTAKE, star, planet, snapshot = "Which is a star?" to "Venus"),
                    ),
                )
            val viewModel = viewModel(api)
            val read = started(viewModel).read
            assertEquals(mapOf(0 to "Moon", 2 to "Venus"), read.lastAnswers)

            api.answer = { practiceFeedback(isCorrect = true) }
            viewModel.answer()
            advanceUntilIdle()
            viewModel.next(read.questions)
            api.answer = { practiceFeedback(isCorrect = false) }
            viewModel.answer(Answer.Choice(1))
            advanceUntilIdle()
            viewModel.next(read.questions)
            api.answer = { practiceFeedback(isCorrect = true) }
            viewModel.answer()
            advanceUntilIdle()

            assertEquals(
                3,
                api.answers
                    .map { it.attemptId }
                    .distinct()
                    .size,
            )
            assertEquals(listOf(Segment.Right, Segment.Wrong, Segment.Right, Segment.Ahead), segments(read.questions, viewModel.now.run))
        }

    @Test
    fun leavingWhileTheEndSavesWaitsForIt() =
        runTest(dispatcher) {
            val saved = CompletableDeferred<Unit>()
            val api = FakeMistakesApi(twoMistakes)
            api.finish = {
                saved.await()
                completion()
            }
            val viewModel = viewModel(api)
            started(viewModel)

            viewModel.answer()
            advanceUntilIdle()
            viewModel.leave()
            runCurrent()
            viewModel.leave()
            runCurrent()
            assertEquals(false, viewModel.closed.value)

            saved.complete(Unit)
            advanceUntilIdle()
            assertEquals(true, viewModel.closed.value)
            assertEquals(1, api.finishes.size)
        }

    @Test
    fun leavingWhileAnAnswerIsCheckedEndsTheRunOnceItsBack() =
        runTest(dispatcher) {
            val checked = CompletableDeferred<Unit>()
            val api = FakeMistakesApi(twoMistakes)
            api.answer = {
                checked.await()
                practiceFeedback()
            }
            val viewModel = viewModel(api)
            started(viewModel)

            viewModel.answer()
            runCurrent()
            viewModel.leave()
            runCurrent()
            assertEquals(0, api.finishes.size)

            checked.complete(Unit)
            advanceUntilIdle()
            assertEquals(
                1,
                api.finishes
                    .single()
                    .answerIds.size,
            )
            assertEquals(RunPhase.Finishing, viewModel.now.run.phase)
        }

    @Test
    fun theLastAnswerShowsOnlyBesideTheMistakesOwnQuestion() {
        val read =
            practice(
                practiceEntry(
                    FIRST_MISTAKE,
                    practiceQuestion(FIRST, "context" to "Look up tonight.", "question" to "Which is   a planet?"),
                    practiceQuestion(SECOND, "question" to "Which orbits the Sun?"),
                ),
            ).let {
                it.copy(
                    practice =
                        it.practice.map { entry ->
                            entry.copy(snapshot = entry.snapshot.copy(question = "Look up tonight. Which is a planet?"))
                        },
                )
            }.toQuestions()

        assertEquals(mapOf(0 to "Moon"), read.lastAnswers)
        assertEquals(listOf(FIRST_MISTAKE, FIRST_MISTAKE), read.questions.map { it.mistakeId })
        assertEquals(Drill.Kind.Retry, read.questions[1].drill?.kind)
        assertEquals(TrueFalseWords.TrueFalse, read.words)
    }

    @Test
    fun aContentGapOpensOnItsLessonsIdeas() =
        runTest(dispatcher) {
            val lesson =
                JsonObject(
                    mapOf(
                        "id" to JsonPrimitive("cb4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"),
                        "ideas" to JsonArray(listOf(JsonPrimitive("Planets orbit a star."))),
                        "title" to JsonPrimitive("Planets"),
                    ),
                )
            val api =
                FakeMistakesApi(
                    practice(
                        practiceEntry(
                            FIRST_MISTAKE,
                            practiceQuestion(FIRST),
                            practiceQuestion(SECOND),
                            drill = drill("reteach", lesson = lesson),
                        ),
                    ),
                )
            val viewModel = viewModel(api)
            val read = started(viewModel).read

            assertEquals(DrillStage.Ideas, viewModel.now.run.stage)
            viewModel.startDrill(read.questions)
            viewModel.answer()
            advanceUntilIdle()
            viewModel.next(read.questions)

            assertEquals(DrillStage.Open, viewModel.now.run.stage)
        }

    private companion object {
        const val FIRST = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val FIRST_ANSWER = "db4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND_ANSWER = "eb4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
    }
}
