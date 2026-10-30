package com.zoonk.android.feature.activities.code

import com.zoonk.android.feature.activities.assignmentAnswer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsPausesInner as Pause
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsTraceInner as TraceStep
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsTraceInnerValuesInner as Traced
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsTraceInnerValuesInnerValue as TraceValue

// Main's `tracer-steps.test.ts`.
class TracerStepsTest {
    private fun step(
        line: Long,
        vararg values: Pair<String, Double>,
    ) = TraceStep(line, values.map { (name, value) -> Traced(name, TraceValue.DoubleValue(value)) })

    private val trace =
        listOf(
            step(1, "lo" to 0.0, "hi" to 7.0),
            step(3, "lo" to 0.0, "mid" to 3.0),
            step(3, "lo" to 4.0, "mid" to 5.0),
            step(3, "lo" to 6.0, "mid" to 6.0),
        )

    private fun pause(step: Long) = Pause(options = emptyList(), question = "?", step = step, variable = "mid")

    @Test
    fun carriesAValueForwardUntilAStepChangesItAndMarksTheChange() {
        assertEquals(
            listOf(
                WatchedValue("lo", value = "4", previous = "0", changed = true),
                WatchedValue("hi", value = "7", previous = "7", changed = false),
                WatchedValue("mid", value = "5", previous = "3", changed = true),
            ),
            watchedValues(2, trace, listOf("lo", "hi", "mid")),
        )
    }

    @Test
    fun hasNoValuesBeforeTheFirstStepAndNothingChangedOnIt() {
        assertEquals(listOf(WatchedValue("lo", null, null, changed = false)), watchedValues(-1, trace, listOf("lo")))
        assertEquals(listOf(WatchedValue("mid", null, null, changed = false)), watchedValues(0, trace, listOf("mid")))
    }

    @Test
    fun stopsSteppingIntoAPausedStepUntilTheresAPrediction() {
        val pauses = listOf(pause(3))

        assertEquals(IndexedValue(0, pauses[0]), blockingPause(pauses, emptyMap(), 2))
        assertNull(blockingPause(pauses, mapOf("0" to "b"), 2))
        assertNull(blockingPause(pauses, emptyMap(), 1))
    }

    @Test
    fun startsBeforeTheFirstLineWhenTheFirstLineItselfIsAPause() {
        assertEquals(0, firstStep(listOf(pause(3))))
        assertEquals(-1, firstStep(listOf(pause(0))))
    }

    @Test
    fun answersOnceEveryPauseHasAPrediction() {
        val pauses = listOf(pause(1), pause(3))

        assertNull(tracerAnswer(pauses, mapOf("0" to "a")))
        assertEquals(assignmentAnswer(mapOf("0" to "a", "1" to "c")), tracerAnswer(pauses, mapOf("0" to "a", "1" to "c")))
    }
}
