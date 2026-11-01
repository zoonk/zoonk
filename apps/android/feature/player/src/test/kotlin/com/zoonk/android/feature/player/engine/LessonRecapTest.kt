package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.checkStep
import com.zoonk.android.feature.player.explanationStep
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepBasis
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.TextHook
import com.zoonk.android.feature.player.stepResult
import com.zoonk.api.ApiJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LessonRecapTest {
    private val quote = "It spreads out into a **cloud of possibilities**: a map of where it might be."

    private fun question(
        id: String,
        position: Int,
        restsOn: Int? = null,
    ): LessonStep {
        val check = checkStep(id)
        val content = (check.content as StepContent.Check).content
        return check.copy(
            content = StepContent.Check(content.copy(basis = restsOn?.let { StepBasis(position = it.toLong(), quote = quote) })),
            position = position,
        )
    }

    private val hook =
        LessonStep(
            "hook",
            null,
            StepContent.Fact(ApiJson.decodeFromString(TextHook.serializer(), """{"text":"Guess why.","variant":"text"}""")),
        )

    private val back = listOf("hook", "quiz", "first", "second", "quiz")

    private fun stateAt(
        steps: List<LessonStep>,
        queue: List<String> = steps.map { it.id },
        position: Int,
        checked: Boolean = false,
    ): LessonPlayerState {
        val state = LessonPlayerState.initial("lesson", steps, now = 0).copy(queue = queue, position = position)
        return if (checked) state.copy(phase = LessonPhase.Feedback, results = mapOf(queue[position] to stepResult(false))) else state
    }

    private fun recapOf(
        written: List<LessonStep>,
        played: List<String>,
        checked: Boolean = false,
    ): String? {
        val steps = written.mapIndexed { position, step -> step.copy(position = position) }
        return stateAt(steps, queue = played, position = played.lastIndex, checked = checked).recap()?.id
    }

    private fun markOf(
        steps: List<LessonStep>,
        question: LessonStep,
    ): String? {
        val recap = stateAt(steps, position = steps.indexOf(question)).recap() ?: return null
        return question.recapMark(recap)
    }

    @Test
    fun marksTheSentenceAQuestionRestsOnWhenTheRecapShowsItsScreen() {
        val explanation = explanationStep("idea").copy(position = 1)
        val check = question("quiz", position = 2, restsOn = 1)

        assertEquals(quote, markOf(listOf(explanation, check), check))
    }

    @Test
    fun marksNothingWhenTheRecapShowsAnotherScreenOrTheQuestionHasNoBasis() {
        val explanation = explanationStep("idea").copy(position = 1)
        val later = explanationStep("later").copy(position = 2)
        val resting = question("quiz", position = 3, restsOn = 1)
        val plain = question("plain", position = 2)

        assertNull(markOf(listOf(explanation, later, resting), resting))
        assertNull(markOf(listOf(explanation, plain), plain))
    }

    @Test
    fun aQuestionThatGaveUpItsPlaceRecapsFromWhereItWasWritten() {
        val first = explanationStep("first").copy(position = 0)
        val quiz = question("quiz", position = 1)
        val second = explanationStep("second").copy(position = 2)
        val steps = listOf(first, quiz, second)

        val state = stateAt(steps, queue = listOf("first", "second", "quiz"), position = 2)

        assertEquals("first", state.recap()?.id)
    }

    @Test
    fun aQuestionMovedAheadOfItsExplanationsRecapsTheOneItWasWrittenAfterOnceRead() {
        val written = listOf(hook, explanationStep("first"), explanationStep("second"), checkStep("quiz"))

        assertNull(recapOf(written, listOf("hook", "quiz")))
        assertNull(recapOf(written, listOf("hook", "quiz"), checked = true))
        assertEquals("second", recapOf(written, back))
    }

    @Test
    fun aQuestionWrittenBeforeItsExplanationsRecapsTheOneAfterItOnceChecked() {
        val written = listOf(hook, checkStep("quiz"), explanationStep("first"), explanationStep("second"))
        val explainedFirst = listOf("hook", "first", "second", "quiz")

        assertNull(recapOf(written, listOf("hook", "quiz"), checked = true))
        assertNull(recapOf(written, back))
        assertEquals("first", recapOf(written, back, checked = true))
        assertNull(recapOf(written, explainedFirst))
        assertEquals("first", recapOf(written, explainedFirst, checked = true))
    }

    @Test
    fun explainFirstKeepsTheScreenAQuestionWasWrittenAfter() {
        val written = listOf(explanationStep("first"), checkStep("quiz"), explanationStep("second"))

        assertEquals("first", recapOf(written, listOf("first", "second", "quiz")))
    }
}
