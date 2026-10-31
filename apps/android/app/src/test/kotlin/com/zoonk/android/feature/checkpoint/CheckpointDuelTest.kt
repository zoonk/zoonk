package com.zoonk.android.feature.checkpoint

import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.Checkpoint
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckpointDuelTest {
    @Test
    fun aBossIsWonAtItsPassMarkAndLostOnceMissesLeaveTooFew() {
        assertEquals(DuelDecision.Won, duelDecision(Checkpoint.Kind.BOSS, passMark = 2, answered = 2, correct = 2, questions = 3))
        assertNull(duelDecision(Checkpoint.Kind.BOSS, passMark = 2, answered = 1, correct = 0, questions = 3))
        assertEquals(DuelDecision.Lost, duelDecision(Checkpoint.Kind.BOSS, passMark = 2, answered = 2, correct = 0, questions = 3))
        assertNull(duelDecision(Checkpoint.Kind.WEEKLY, passMark = 2, answered = 3, correct = 0, questions = 3))
    }

    @Test
    fun aRemovedQuestionsVerdictStillCounts() {
        val checkpoint =
            checkpoint(
                duelQuestion(Q1, answered = false),
                duelQuestion(Q2),
                fields =
                    arrayOf(
                        "answeredQuestions" to
                            JsonArray(listOf(JsonObject(mapOf("isCorrect" to JsonPrimitive(false), "itemId" to JsonPrimitive(REMOVED))))),
                    ),
            )
        val read = checkpoint.read()
        val state = DuelState.of(checkpoint)

        assertEquals(DuelScore(answered = 2, correct = 0, questions = 3, decision = DuelDecision.Lost), state.score(read))
        assertNull(state.current(read))
    }

    @Test
    fun theAnsweredQuestionStaysUntilNextThenTheFirstUnanswered() {
        val read = checkpoint().read()
        val answered =
            DuelState
                .of(
                    read.checkpoint,
                ).answered(Q1, Answer.Choice(0), isCorrect = true, reinforcementLessons = null, transcript = null)

        assertEquals(Q1, answered.current(read)?.itemId)
        assertEquals(Q2, answered.copy(feedback = null).current(read)?.itemId)
    }

    @Test
    fun aCompletedCheckpointOpensOnItsResult() {
        assertTrue(DuelState.of(checkpoint(fields = arrayOf("status" to "completed"))).showsResult)
        assertTrue(DuelState.of(checkpoint(fields = arrayOf("status" to "skipped", "endedWithoutQuestions" to true))).showsResult)
    }
}
