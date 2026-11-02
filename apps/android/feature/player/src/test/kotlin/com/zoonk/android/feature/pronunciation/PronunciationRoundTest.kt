package com.zoonk.android.feature.pronunciation

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceIssue
import com.zoonk.android.feature.player.engine.Segment
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.PronunciationAnswerGrade
import com.zoonk.api.models.PronunciationRoundResult
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PronunciationRoundTest {
    private val answered = mutableListOf<String>()
    private val finished = mutableListOf<String>()

    private fun round(
        vararg words: ReviewWord,
        grades: List<GradeOutcome<PronunciationAnswerGrade>> = emptyList(),
        finishFails: Int = 0,
    ): PronunciationRound {
        val pending = grades.toMutableList()
        var fails = finishFails
        return PronunciationRound(
            language = "es",
            words = words.toList(),
            answer = { reviewId, _, _ ->
                answered += reviewId
                pending.removeAt(0)
            },
            complete = { roundId ->
                finished += roundId
                if (fails-- > 0) MutationResult.Failed(ApiError.Network) else MutationResult.Done<PronunciationRoundResult>(RESULT)
            },
        )
    }

    @Test
    fun aWordSaidRightThenTheRoundCountsOnce() =
        runTest {
            val round = round(word(1, "a"), grades = listOf(GradeOutcome.Graded(grade(isCorrect = true))))

            round.record(round.attempt, RECORDING)
            assertEquals(mapOf(0 to Segment.Right), round.outcomes)

            round.next()
            assertEquals(RoundStep.Result(RESULT), round.step)
            assertEquals(listOf(word(1, "a").id.toString()), answered)
            assertEquals(listOf(round.roundId), finished)
        }

    @Test
    fun tryingAgainStartsTheWordOver() =
        runTest {
            val round =
                round(
                    word(1, "a"),
                    grades = listOf(GradeOutcome.Graded(grade(isCorrect = false)), GradeOutcome.Graded(grade(isCorrect = true))),
                )

            round.record(round.attempt, RECORDING)
            assertEquals(mapOf(0 to Segment.Wrong), round.outcomes)

            round.tryAgain()
            assertEquals(RoundStep.Word(0), round.step)
            assertEquals(emptyMap<Int, Segment>(), round.outcomes)

            round.record(round.attempt, RECORDING)
            assertEquals(mapOf(0 to Segment.Right), round.outcomes)
        }

    @Test
    fun nothingSaidEndsWithoutCountingTheRound() =
        runTest {
            val round = round(word(1, "a"), word(2, "b"))

            round.next()
            round.next()

            assertEquals(RoundStep.Result(null), round.step)
            assertEquals(mapOf(0 to Segment.Read, 1 to Segment.Read), round.outcomes)
            assertTrue(finished.isEmpty())
        }

    @Test
    fun aRecordingWithoutWordsOrALimitKeepsTheWord() =
        runTest {
            val round =
                round(
                    word(1, "a"),
                    grades =
                        listOf(
                            GradeOutcome.NoSpeech,
                            GradeOutcome.Limited(Limit.SignUpRequired),
                            GradeOutcome.Failed,
                            GradeOutcome.Obsolete,
                        ),
                )

            round.record(round.attempt, RECORDING)
            assertEquals(RoundStep.Word(0, issue = VoiceIssue.NoSpeech), round.step)

            round.record(round.attempt, RECORDING)
            assertEquals(RoundStep.Word(0, issue = VoiceIssue.Limited(Limit.SignUpRequired)), round.step)

            round.record(round.attempt, RECORDING)
            assertEquals(RoundStep.Word(0, issue = VoiceIssue.Failed), round.step)

            round.record(round.attempt, RECORDING)
            assertEquals(RoundStep.Word(0, issue = VoiceIssue.Failed), round.step)
            assertEquals(emptyMap<Int, Segment>(), round.outcomes)
            assertFalse(round.pending)
        }

    @Test
    fun aFailedFinishCanBeRetried() =
        runTest {
            val round = round(word(1, "a"), grades = listOf(GradeOutcome.Graded(grade(isCorrect = true))), finishFails = 1)

            round.record(round.attempt, RECORDING)
            round.next()
            assertTrue(round.finishFailed)

            round.finish()
            assertFalse(round.finishFailed)
            assertEquals(RoundStep.Result(RESULT), round.step)
        }

    @Test
    fun aTakeThatArrivesAfterItsWordWasLeftIsDropped() =
        runTest {
            val round = round(word(1, "a"), word(2, "b"), grades = listOf(GradeOutcome.Graded(grade(isCorrect = true))))

            round.next()
            round.record(0, RECORDING)

            assertEquals(RoundStep.Word(1), round.step)
            assertTrue(answered.isEmpty())
        }

    @Test
    fun aTakeThatArrivesOnceTheWordHasItsGradeIsDropped() =
        runTest {
            val round =
                round(
                    word(1, "a"),
                    grades = listOf(GradeOutcome.Graded(grade(isCorrect = false)), GradeOutcome.Graded(grade(isCorrect = true))),
                )

            round.record(0, RECORDING)
            round.record(0, RECORDING)

            assertEquals(mapOf(0 to Segment.Wrong), round.outcomes)
            assertEquals(1, answered.size)
        }

    @Test
    fun aTakeStoppedBeforeTryAgainNeverAnswersTheNewAttempt() =
        runTest {
            val round =
                round(
                    word(1, "a"),
                    grades = listOf(GradeOutcome.Graded(grade(isCorrect = false)), GradeOutcome.Graded(grade(isCorrect = true))),
                )
            val before = round.attempt

            round.record(before, RECORDING)
            round.tryAgain()
            round.record(before, RECORDING)
            assertEquals(RoundStep.Word(0), round.step)
            assertEquals(1, answered.size)

            round.record(round.attempt, RECORDING)
            assertEquals(mapOf(0 to Segment.Right), round.outcomes)
        }

    @Test
    fun noWordsDueShowsTheEndAtOnce() {
        assertEquals(RoundStep.Result(null), round().step)
    }
}
