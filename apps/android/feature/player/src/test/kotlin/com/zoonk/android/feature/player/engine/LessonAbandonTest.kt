package com.zoonk.android.feature.player.engine

import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.feature.player.checkStep
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.stepResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LessonAbandonTest {
    private val steps = listOf("a", "b", "c").associateWith { checkStep(it) }
    private val started = LessonRun.Started("run", HyperdriveStart(emptySet(), 0), emptySet())

    @Test
    fun wrongAnswersCountFromTheLastRightOneWithEachScreenAtItsLatestAnswer() {
        val state =
            LessonPlayerState(
                lessonId = "lesson",
                steps = steps,
                queue = listOf("a", "b", "c", "a"),
                position = 3,
                results = mapOf("a" to stepResult(false), "b" to stepResult(true), "c" to stepResult(false)),
                run = started,
            )

        assertEquals(
            AnalyticsEvent.ActivityAbandoned("lesson", screen = 4, stepKind = StepKind.Check, wrongInARow = 2),
            state.abandonEvent(),
        )
        assertEquals("check", state.abandonEvent()?.properties?.get("step_kind"))
    }

    @Test
    fun onlyAStartedRunBeforeItsEndIsAbandoned() {
        val state = LessonPlayerState(lessonId = "lesson", steps = steps, queue = listOf("a"))

        assertNull(state.abandonEvent())
        assertNull(state.copy(run = started, phase = LessonPhase.Completed).abandonEvent())
    }
}
