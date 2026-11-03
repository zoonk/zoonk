package com.zoonk.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GenerationKindTest {
    private fun run(
        vararg steps: Pair<String, StepState>,
        status: GenerationRun.Status = GenerationRun.Status.Following,
        failure: GenerationFailure? = null,
        times: Map<String, StepTimes> = emptyMap(),
    ) = GenerationRun(status = status, failure = failure, steps = steps.toMap(), stepTimes = times)

    @Test
    fun anOptionalPhaseShowsOnlyOnceTheRunReportsIt() {
        val reading = GenerationKind.Understanding.progress(run("readGoal" to StepState.Started))
        assertEquals(listOf("read"), reading.phases.map { it.phase.id })
        assertEquals(PhaseStatus.Active, reading.phases.single().status)

        val dating = GenerationKind.Understanding.progress(run("readGoal" to StepState.Completed, "findExamDates" to StepState.Started))
        assertEquals(listOf(PhaseStatus.Completed, PhaseStatus.Active), dating.phases.map { it.status })
        assertEquals(8f / 20f, dating.share)
        assertEquals(1f, dating.target)
        assertEquals(12_000L, dating.activeMillis)
    }

    @Test
    fun aPhaseWhoseStepsAllFinishedHandsOverToTheNext() {
        val progress = GenerationKind.Curriculum.progress(run("understandGoal" to StepState.Completed))
        assertEquals(listOf("goal", "skills", "plan"), progress.phases.map { it.phase.id })
        assertEquals(listOf(PhaseStatus.Completed, PhaseStatus.Active, PhaseStatus.Pending), progress.phases.map { it.status })
    }

    @Test
    fun theSavedPlanEndsTheWaitWhileOutlinesGoOn() {
        val progress = GenerationKind.Curriculum.progress(run("createPlan" to StepState.Completed))
        assertEquals(1f, progress.share)
        assertNull(progress.activeMillis)
        assert(progress.phases.all { it.status == PhaseStatus.Completed })
    }

    @Test
    fun aFailedRunStopsAtItsPhase() {
        val progress =
            GenerationKind.Understanding.progress(
                run("readGoal" to StepState.Started, status = GenerationRun.Status.Failed, failure = GenerationFailure.Generation),
            )
        assertEquals(PhaseStatus.Failed, progress.phases.single().status)
        assertNull(progress.activeMillis)
    }

    @Test
    fun aPhaseStartsAsTheOneBeforeItEndsWhenItReportsNoTimeOfItsOwn() {
        val progress =
            GenerationKind.Understanding.progress(
                run(
                    "readGoal" to StepState.Completed,
                    "findExamDates" to StepState.Started,
                    times = mapOf("readGoal" to StepTimes(started = 1_000, completed = 5_000)),
                ),
            )
        assertEquals(1_000L, progress.phases[0].startedAt)
        assertEquals(5_000L, progress.phases[0].endedAt)
        assertEquals(5_000L, progress.phases[1].startedAt)
        assertNull(progress.phases[1].endedAt)
    }

    @Test
    fun aRunningPhaseKeepsItsStartWhenItsOwnStepReportsLater() {
        val times =
            mapOf(
                "understandGoal" to StepTimes(started = 1_000),
                "buildSkillGraph" to StepTimes(started = 2_000, completed = 30_000),
                "saveSkills" to StepTimes(started = 41_000),
            )
        val steps =
            arrayOf("understandGoal" to StepState.Started, "buildSkillGraph" to StepState.Completed, "saveSkills" to StepState.Started)

        val running = GenerationKind.Curriculum.progress(run(*steps, times = times)).phases[2]
        assertEquals(30_000L, running.startedAt)

        val done =
            GenerationKind.Curriculum
                .progress(
                    run(*steps, "createPlan" to StepState.Completed, times = times + ("createPlan" to StepTimes(completed = 54_000))),
                ).phases[2]
        assertEquals(30_000L, done.startedAt)
        assertEquals(54_000L, done.endedAt)
    }

    @Test
    fun theLastPhaseEndsWhenTheRunIsDone() {
        val progress =
            GenerationKind.Placement.progress(
                run(
                    "buildSkillGraph" to StepState.Completed,
                    "createPlan" to StepState.Completed,
                    "goalReady" to StepState.Completed,
                    times =
                        mapOf(
                            "buildSkillGraph" to StepTimes(started = 2_000, completed = 30_000),
                            "createPlan" to StepTimes(completed = 54_000),
                            "goalReady" to StepTimes(completed = 90_000),
                        ),
                ),
            )
        assertEquals(30_000L, progress.phases.last().startedAt)
        assertEquals(90_000L, progress.phases.last().endedAt)
    }
}
