package com.zoonk.android.feature.tutor

import org.junit.Assert.assertEquals
import org.junit.Test

class TurnsSeenTest {
    private val seen = TurnsSeen()
    private val signals = mutableListOf<String>()

    private fun check(vararg turns: TutorTurn) =
        seen.check(turns.toList(), onAsked = { signals += "asked" }, onAnswered = {
            signals +=
                "answered"
        })

    @Test
    fun aQuestionAskedHereSignalsItsAskingThenItsAnswerOnce() {
        check(turn("q1", TutorTurn.Status.Completed, "Old."))
        check(turn("q1", TutorTurn.Status.Completed, "Old."), turn("q2", TutorTurn.Status.Pending, null))
        check(turn("q1", TutorTurn.Status.Completed, "Old."), turn("q2", TutorTurn.Status.Running, "A"))
        check(turn("q1", TutorTurn.Status.Completed, "Old."), turn("q2", TutorTurn.Status.Completed, "Answer."))
        check(turn("q1", TutorTurn.Status.Completed, "Old."), turn("q2", TutorTurn.Status.Completed, "Answer."))

        assertEquals(listOf("asked", "answered"), signals)
    }

    @Test
    fun anAnswerAlreadyRunningWhenItOpensOnlySignalsWhenItFinishes() {
        check(turn("q1", TutorTurn.Status.Running, "A"))
        check(turn("q1", TutorTurn.Status.Completed, "Answer."))

        assertEquals(listOf("answered"), signals)
    }

    @Test
    fun aFailedAnswerIsNoAnswer() {
        check()
        check(turn("q1", TutorTurn.Status.Pending, null))
        check(turn("q1", TutorTurn.Status.Failed, null))

        assertEquals(listOf("asked"), signals)
    }
}
