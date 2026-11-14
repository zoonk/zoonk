package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.SpokenAnswerGrade
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

/** An answer the server didn't check (a staff fix changed its screen mid-run) reads as not checked, never as wrong. */
class LessonVerdictTest {
    @Test
    fun aSpokenTakeTheServerDidntScoreIsNotChecked() {
        val result =
            SpokenAnswerGrade(
                attemptId = UUID.randomUUID(),
                explanation = null,
                isCorrect = false,
                score = 0.0,
                transcript = "hola",
                words = emptyList(),
                wordsToPractice = emptyList(),
                checked = false,
            ).toStepResult(targetText = "hola, amigo")

        assertEquals(Verdict.Unchecked, verdictOf(StepKind.SpokenAnswer, result))
        assertNull(result.correctAnswer)
    }

    @Test
    fun aCheckedQuestionWhoseScreenWasFixedIsNotChecked() {
        val typed = uncheckedCheck().toStepResult(answerText = "Photosynthesis")
        val restoredChoice = StepResult(isCorrect = false, checked = false)

        assertEquals(Verdict.Unchecked, verdictOf(StepKind.TypedAnswer, typed))
        assertEquals(Verdict.Unchecked, verdictOf(StepKind.MultipleChoice, restoredChoice))
    }

    @Test
    fun onlyIDontKnowYetShowsItsSampleAndACheckedMissStaysWrong() {
        val sample = StepResult(isCorrect = false, checked = false, correctAnswer = "Plants make sugar from light.")

        assertEquals(Verdict.SampleAnswer, verdictOf(StepKind.TypedAnswer, sample))
        assertEquals(Verdict.Incorrect, verdictOf(StepKind.MultipleChoice, StepResult(isCorrect = false)))
    }

    private fun uncheckedCheck() =
        LessonStepCheckResult(
            checked = false,
            correctAnswer = null,
            corrections = emptyList(),
            expected = null,
            feedback = null,
            isCorrect = false,
            keyPoints = null,
            savedMistake = false,
            score = null,
            spelling = null,
        )
}
