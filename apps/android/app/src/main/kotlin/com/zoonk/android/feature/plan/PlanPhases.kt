package com.zoonk.android.feature.plan

import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanPhaseCheckpoint
import kotlinx.datetime.toJavaLocalDate
import java.text.Normalizer
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.max
import kotlin.math.min

/** The phases the roadmap draws: after the exam and left out phases stay off it. */
val Plan.roadmapPhases: List<PlanPhase>
    get() = phases.filter { it.kind != PlanPhase.Kind.AFTER_EXAM && it.state != PlanPhase.State.LEFT_OUT }

val PlanPhase.start: LocalDate? get() = startDate?.toJavaLocalDate()

val PlanPhase.end: LocalDate? get() = endDate?.toJavaLocalDate()

fun PlanPhase.lessonShare(): Float =
    when {
        state == PlanPhase.State.DONE -> 1f
        lessonsTotal > 0 -> min(1f, lessonsDone.toFloat() / lessonsTotal)
        else -> 0f
    }

/** Both its first and last day count: the planner's `endDate` is its last day. */
private fun PlanPhase.days(): Long? {
    val start = start ?: return null
    val end = end ?: return null
    return max(1, ChronoUnit.DAYS.between(start, end) + 1)
}

/** Days when it has dates, else hours, so every drawing of the phases shares one scale: time. */
fun PlanPhase.weight(): Float = days()?.toFloat() ?: max(1.0, hours).toFloat()

enum class DayPart(
    internal val offset: Double,
) {
    Start(0.0),
    Middle(0.5),
    End(1.0),
}

/** 0 is the start of the phase's first day and 1 the end of its last; null without dates. */
fun PlanPhase.shareAt(
    date: LocalDate,
    at: DayPart,
): Float? {
    val days = days() ?: return null
    val start = start ?: return null
    return ((ChronoUnit.DAYS.between(start, date) + at.offset) / days).coerceIn(0.0, 1.0).toFloat()
}

data class PhaseDay(
    val day: Long,
    val days: Long,
)

fun PlanPhase.dayOf(today: LocalDate): PhaseDay? {
    val days = days() ?: return null
    val start = start ?: return null
    return PhaseDay((ChronoUnit.DAYS.between(start, today) + 1).coerceIn(1, days), days)
}

/** When the goal ends on the roadmap: its date, or the estimate for a goal without one (never an exam's). */
data class PlanFinish(
    val date: LocalDate,
    val estimate: Boolean,
    val month: Boolean,
)

fun Plan.finish(goalKind: LearnerSummaryGoal.Kind): PlanFinish? {
    schedule.targetDate?.let {
        return PlanFinish(it.toJavaLocalDate(), schedule.targetDateEstimated, schedule.targetDateNamedMonth)
    }
    val end = estimate.endDate?.toJavaLocalDate() ?: return null
    if (goalKind == LearnerSummaryGoal.Kind.EXAM) return null
    val start = week.startDate.toJavaLocalDate()
    return PlanFinish(end, estimate = true, month = ChronoUnit.DAYS.between(start, end) > NEAR_ESTIMATE_DAYS)
}

/** Where the goal's date falls when phases go on past it. */
data class PlanOverrun(
    val phaseIndex: Long,
    val share: Float,
)

fun Plan.overrun(goalKind: LearnerSummaryGoal.Kind): PlanOverrun? {
    val finish = finish(goalKind) ?: return null
    val phases = roadmapPhases
    val last = phases.lastOrNull()?.end ?: return null
    if (!last.isAfter(finish.date)) return null
    val phase = phases.firstOrNull { it.end?.isBefore(finish.date) == false } ?: return null
    val share = phase.shareAt(finish.date, DayPart.End) ?: return null
    return PlanOverrun(phase.index, share)
}

private const val NEAR_ESTIMATE_DAYS = 42

/** The phase the path opens: the one holding the next chapter, else the current one. */
fun findOpenPhase(phases: List<PlanPhase>): Long? =
    (
        phases.firstOrNull { phase -> phase.chapters.any { it.state == PlanPhaseChaptersInner.State.CURRENT } }
            ?: phases.firstOrNull { it.state == PlanPhase.State.CURRENT }
    )?.index

/** A phase whose only chapter carries its name shows as that chapter. */
fun PlanPhase.ownChapter(name: String): PlanPhaseChaptersInner? {
    val rows = chapters.filter { !it.writing || it.far }
    val only = rows.singleOrNull() ?: return null
    return only.takeIf { it.chapterId != null && sameName(it.title, name) }
}

/**
 * Old plans keep phase names their skill graph's checks now prevent, and Library chapters are named
 * after the graph, so a phase can share a chapter's name.
 */
fun PlanPhase.isNamedLikeAChapter(name: String): Boolean = chapters.any { sameName(it.title, name) }

private fun sameName(
    first: String,
    second: String,
) = normalize(first) == normalize(second)

private fun normalize(text: String) =
    Normalizer
        .normalize(text, Normalizer.Form.NFD)
        .replace(COMBINING_MARKS, "")
        .lowercase()
        .replace(SPACES, " ")
        .trim()

private val COMBINING_MARKS = Regex("\\p{M}+")
private val SPACES = Regex("\\s+")

val PlanPhaseChaptersInner.isSkipped: Boolean get() = skills.isNotEmpty() || testedOut

/** Lessons on the way inside the next two weeks: said in a line under the phase, not as a row. */
val PlanPhaseChaptersInner.isWritingAhead: Boolean get() = writing && !far && skills.isEmpty()

/** Main shows four chapters around the next one; the rest behind "N more chapters". */
fun chapterWindow(states: List<PlanPhaseChaptersInner.State>): IntRange {
    val current = states.indexOf(PlanPhaseChaptersInner.State.CURRENT)
    val focus = if (current == -1) states.indexOfFirst { it != PlanPhaseChaptersInner.State.DONE } else current
    val anchor = max(0, focus - 1)
    val start = max(0, min(anchor, states.size - SHOWN_CHAPTERS))
    return start until min(states.size, start + SHOWN_CHAPTERS)
}

private const val SHOWN_CHAPTERS = 4

/** Phases still to walk, before the exam. */
private val Plan.phasesAhead: List<PlanPhase>
    get() =
        phases.filter {
            it.kind != PlanPhase.Kind.AFTER_EXAM &&
                (it.state == PlanPhase.State.CURRENT || it.state == PlanPhase.State.UPCOMING)
        }

val Plan.nextCheckpoint: PlanPhaseCheckpoint?
    get() = phasesAhead.firstNotNullOfOrNull { phase -> phase.checkpoint?.takeIf { it.state == PlanPhaseCheckpoint.State.UPCOMING } }

val Plan.nextMockDate: LocalDate?
    get() = phasesAhead.firstNotNullOfOrNull { it.mocks.nextDate }?.toJavaLocalDate()

val Plan.nextChapter: PlanPhaseChaptersInner?
    get() = phases.flatMap { it.chapters }.firstOrNull { it.state == PlanPhaseChaptersInner.State.CURRENT }

/** Far topics aren't being written, so reading them again would change nothing. */
val Plan.isPhaseBeingWritten: Boolean
    get() =
        phases.any { phase ->
            phase.state == PlanPhase.State.CURRENT && phase.chapters.any { it.writing && !it.far }
        }
