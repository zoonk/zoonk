package com.zoonk.android.data

/** [seconds] is its usual duration on real runs, which weighs it in the bar. */
data class GenerationPhase(
    val id: String,
    val seconds: Int,
    val optional: Boolean = false,
)

sealed interface StepPlace {
    data class Phase(
        val id: String,
    ) : StepPlace

    data object Done : StepPlace

    /** The run handed over to one already writing the same thing, named in the event's `entityId`. */
    data object Join : StepPlace
}

/**
 * What a run writes, with its steps mapped to the wait's phases as main's
 * `packages/learn/src/generation/generation-kinds.ts` maps them. A new kind goes here with its words
 * in `GenerationWait`.
 */
enum class GenerationKind(
    val phases: List<GenerationPhase>,
    val steps: Map<String, StepPlace>,
    /** Done once this step completes, before the run's own end: the screen needs only what it wrote. */
    val doneOnCompleted: String? = null,
) {
    Understanding(
        phases = listOf(GenerationPhase("read", 8), GenerationPhase("dates", 12, optional = true)),
        steps =
            mapOf(
                "findExamDates" to StepPlace.Phase("dates"),
                "joinRunningUnderstanding" to StepPlace.Join,
                "readGoal" to StepPlace.Phase("read"),
                "understandingReady" to StepPlace.Done,
            ),
    ),
    Curriculum(
        phases = GOAL_PHASES + GenerationPhase("plan", 15),
        steps =
            GOAL_STEPS +
                mapOf(
                    "createPlan" to StepPlace.Phase("plan"),
                    "goalReady" to StepPlace.Done,
                    "outlineCourses" to StepPlace.Done,
                    "prepareFirstLessons" to StepPlace.Done,
                    "preparePlacement" to StepPlace.Phase("plan"),
                    "saveSkills" to StepPlace.Phase("plan"),
                ),
        doneOnCompleted = "createPlan",
    ),
    Placement(
        phases = GOAL_PHASES + GenerationPhase("questions", 40),
        steps =
            GOAL_STEPS +
                mapOf(
                    "createPlan" to StepPlace.Phase("questions"),
                    "goalReady" to StepPlace.Done,
                    "outlineCourses" to StepPlace.Phase("questions"),
                    "prepareFirstLessons" to StepPlace.Phase("questions"),
                    "preparePlacement" to StepPlace.Phase("questions"),
                    "saveSkills" to StepPlace.Phase("questions"),
                ),
    ),
    FirstLesson(
        phases = GOAL_PHASES + GenerationPhase("day", 15),
        steps =
            GOAL_STEPS +
                mapOf(
                    "createPlan" to StepPlace.Phase("day"),
                    "goalReady" to StepPlace.Done,
                    "outlineCourses" to StepPlace.Done,
                    "prepareFirstLessons" to StepPlace.Done,
                    "preparePlacement" to StepPlace.Phase("day"),
                    "saveSkills" to StepPlace.Phase("day"),
                ),
        doneOnCompleted = "createPlan",
    ),
    LevelTestBank(
        phases = listOf(GenerationPhase("bank", 60)),
        steps =
            mapOf(
                "joinLevelTestBank" to StepPlace.Phase("bank"),
                "levelTestBankReady" to StepPlace.Done,
                "writeLevelTestBank" to StepPlace.Phase("bank"),
            ),
    ),
    ;

    fun isDone(steps: Map<String, StepState>): Boolean =
        steps.keys.any { this.steps[it] == StepPlace.Done } ||
            (doneOnCompleted != null && steps[doneOnCompleted] == StepState.Completed)

    internal fun stepsOf(phase: String): List<String> = steps.filterValues { it == StepPlace.Phase(phase) }.keys.toList()
}

private val GOAL_PHASES =
    listOf(
        GenerationPhase("goal", 8),
        GenerationPhase("notice", 15, optional = true),
        GenerationPhase("skills", 60),
    )

private val GOAL_STEPS =
    mapOf(
        "buildSkillGraph" to StepPlace.Phase("skills"),
        "joinRunningGoal" to StepPlace.Join,
        "readExamNotice" to StepPlace.Phase("notice"),
        "understandGoal" to StepPlace.Phase("goal"),
    )

enum class StepState { Started, Completed }

enum class PhaseStatus { Pending, Active, Completed, Failed }

data class PhaseProgress(
    val phase: GenerationPhase,
    val status: PhaseStatus,
    /** Server milliseconds; a run doesn't report every step, so a phase starts as the one before it ends. */
    val startedAt: Long?,
    val endedAt: Long?,
)

data class RunProgress(
    val phases: List<PhaseProgress>,
    /** 0 to 1: the finished work. */
    val share: Float,
    /** 0 to 1: where [share] will be once the active phase finishes. */
    val target: Float,
    /** The active phase's usual duration, null when nothing is running. */
    val activeMillis: Long?,
)

/** Main's `getPhaseProgress` and `getPhaseTimes`: an optional phase shows once a step of it is reported. */
fun GenerationKind.progress(run: GenerationRun): RunProgress {
    val visible = phases.filter { phase -> !phase.optional || stepsOf(phase.id).any(run.steps::containsKey) }
    val total = visible.sumOf { it.seconds }.toFloat()
    val done = run.status == GenerationRun.Status.Ready || isDone(run.steps)
    val activeIndex = if (done) visible.size else activeIndex(visible, run)

    val statuses =
        visible.indices.map { index ->
            when {
                index < activeIndex -> PhaseStatus.Completed
                index > activeIndex -> PhaseStatus.Pending
                run.failure == GenerationFailure.Generation -> PhaseStatus.Failed
                run.failure == GenerationFailure.NotStarted -> PhaseStatus.Pending
                else -> PhaseStatus.Active
            }
        }

    val reported = visible.map { phase -> reportedTimes(phase.id, run.stepTimes) }
    val progress =
        visible.mapIndexed { index, phase ->
            val status = statuses[index]
            val startedAt = reported[index].first ?: reported.getOrNull(index - 1)?.second
            when (status) {
                PhaseStatus.Pending -> {
                    PhaseProgress(phase, status, null, null)
                }

                PhaseStatus.Completed -> {
                    PhaseProgress(
                        phase,
                        status,
                        startedAt,
                        reported[index].second ?: reported.getOrNull(index + 1)?.first,
                    )
                }

                else -> {
                    PhaseProgress(phase, status, startedAt, null)
                }
            }
        }

    if (done) return RunProgress(progress, share = 1f, target = 1f, activeMillis = null)

    val active = visible.getOrNull(activeIndex)
    val finished = visible.take(activeIndex).sumOf { it.seconds }
    val activeSeconds = active?.seconds ?: 0
    val activeShare = active?.let { finishedShare(it.id, run) } ?: 0f

    return RunProgress(
        phases = progress,
        share = share(finished + activeShare * activeSeconds, total),
        target = share(finished + activeSeconds.toFloat(), total),
        activeMillis = active?.takeIf { run.status != GenerationRun.Status.Failed }?.let { it.seconds * 1000L },
    )
}

/** The furthest phase the run reported a step of, or the next one once all of its steps completed. */
private fun GenerationKind.activeIndex(
    visible: List<GenerationPhase>,
    run: GenerationRun,
): Int {
    val latest = visible.indexOfLast { phase -> stepsOf(phase.id).any(run.steps::containsKey) }.coerceAtLeast(0)
    val phase = visible.getOrNull(latest) ?: return latest
    return if (latest < visible.lastIndex && finishedShare(phase.id, run) == 1f) latest + 1 else latest
}

private fun GenerationKind.finishedShare(
    phase: String,
    run: GenerationRun,
): Float {
    val steps = stepsOf(phase)
    return if (steps.isEmpty()) 0f else steps.count { run.steps[it] == StepState.Completed }.toFloat() / steps.size
}

private fun GenerationKind.reportedTimes(
    phase: String,
    stepTimes: Map<String, StepTimes>,
): Pair<Long?, Long?> {
    val times = stepsOf(phase).mapNotNull(stepTimes::get)
    return times.mapNotNull { it.started ?: it.completed }.minOrNull() to times.mapNotNull { it.completed }.maxOrNull()
}

private fun share(
    value: Float,
    total: Float,
) = if (total == 0f) 0f else value / total
