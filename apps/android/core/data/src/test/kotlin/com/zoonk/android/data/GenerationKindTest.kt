package com.zoonk.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GenerationKindTest {
    private fun run(
        vararg steps: Pair<String, StepState>,
        status: GenerationRun.Status = GenerationRun.Status.Following,
        failure: GenerationFailure? = null,
        times: Map<String, StepTimes> = emptyMap(),
    ) = GenerationRun(status = status, failure = failure, steps = steps.toMap(), stepTimes = times)

    @Test
    fun driftStartsAtTheEarliestStepOfTheRunningStageOnTheClientClock() {
        val progress =
            GenerationKind.Lesson.progress(
                GenerationRun(
                    status = GenerationRun.Status.Following,
                    steps =
                        mapOf(
                            "planLesson" to StepState.Completed,
                            "writeLesson" to StepState.Completed,
                            "markLesson" to StepState.Started,
                            "drawPictures" to StepState.Started,
                        ),
                    stepTimes = mapOf("markLesson" to StepTimes(started = 12_000), "drawPictures" to StepTimes(started = 10_000)),
                    clockOffsetMillis = 2_000,
                ),
            )
        assertEquals(12_000L, progress.activeSince)
        assertNull(GenerationKind.Lesson.progress(run("planLesson" to StepState.Started)).activeSince)
    }

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
    fun aLessonsMarkingAndDrawingRunSideBySideEachDoneOnItsOwnSteps() {
        val written = arrayOf("planLesson" to StepState.Completed, "writeLesson" to StepState.Completed)

        fun statuses(vararg steps: Pair<String, StepState>) =
            GenerationKind.Lesson
                .progress(run(*written, *steps))
                .phases
                .map { it.status }

        assertEquals(
            listOf(PhaseStatus.Completed, PhaseStatus.Completed, PhaseStatus.Active, PhaseStatus.Active),
            statuses("markLesson" to StepState.Started, "drawPictures" to StepState.Started),
        )
        assertEquals(
            listOf(PhaseStatus.Completed, PhaseStatus.Completed, PhaseStatus.Completed, PhaseStatus.Active),
            statuses("markLesson" to StepState.Completed, "drawPictures" to StepState.Started),
        )

        val drawnFirst =
            GenerationKind.Lesson.progress(
                run(
                    *written,
                    "markLesson" to StepState.Started,
                    "drawPictures" to StepState.Completed,
                ),
            )
        assertEquals(
            listOf(PhaseStatus.Completed, PhaseStatus.Completed, PhaseStatus.Active, PhaseStatus.Completed),
            drawnFirst.phases.map { it.status },
        )
        assertTrue(drawnFirst.share < 1f)
        assertEquals(10_000L, drawnFirst.activeMillis)
    }

    @Test
    fun aLessonsMarkingAndDrawingStartWhenWritingEndsAndEachEndsAtItsOwnFinish() {
        val written =
            mapOf(
                "planLesson" to StepTimes(started = 1_000, completed = 20_000),
                "writeLesson" to StepTimes(started = 20_000, completed = 50_000),
            )
        val steps = arrayOf("planLesson" to StepState.Completed, "writeLesson" to StepState.Completed)

        val markingFirst =
            GenerationKind.Lesson.progress(
                run(
                    *steps,
                    "markLesson" to StepState.Started,
                    times =
                        written + ("markLesson" to StepTimes(started = 50_000)),
                ),
            )
        assertEquals(listOf(50_000L to null, 50_000L to null), markingFirst.phases.drop(2).map { it.startedAt to it.endedAt })

        val ready =
            GenerationKind.Lesson.progress(
                run(
                    *steps,
                    "markLesson" to StepState.Completed,
                    "drawPictures" to StepState.Completed,
                    "lessonReady" to StepState.Completed,
                    times =
                        written +
                            mapOf(
                                "drawPictures" to StepTimes(started = 50_000, completed = 70_000),
                                "markLesson" to StepTimes(started = 50_000, completed = 250_000),
                                "lessonReady" to StepTimes(completed = 250_010),
                            ),
                ),
            )
        assertEquals(listOf(50_000L to 250_000L, 50_000L to 70_000L), ready.phases.drop(2).map { it.startedAt to it.endedAt })
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
