package com.zoonk.android.feature.plan

import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFinishPrecision
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanPhaseCheckpoint
import com.zoonk.api.models.PlanPhaseShort
import kotlinx.datetime.toJavaLocalDate
import java.text.Normalizer
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs
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

/** A day a phase or the goal ends: "~" while it's an [estimate], said by its month when [month], by its year when [year]. */
data class PlanEnd(
    val date: LocalDate,
    val estimate: Boolean,
    val month: Boolean,
    val year: Boolean = false,
) : PhaseEnd

/**
 * Main's `PhaseEnd`: a short plan names a phase by its days ("Days 1–3"), every other plan by the day it ends ([PlanEnd]),
 * or "Later" while its work has no place in the plan yet.
 */
sealed interface PhaseEnd {
    data class Days(
        val short: PlanPhaseShort,
    ) : PhaseEnd

    data object Later : PhaseEnd
}

/**
 * Main's `getPlanFinish`: the completion day, or the goal's date or estimated end while under way. That end comes from
 * the learner's pace, so a [paused] goal has none; the goal's date, an exam's likely one included, stays.
 */
fun Plan.finish(
    goalKind: LearnerSummaryGoal.Kind,
    paused: Boolean = false,
): PlanEnd? {
    val completion = end
    if (goalKind != LearnerSummaryGoal.Kind.EXAM && completion != null) {
        return completion.finishedOn?.let { PlanEnd(it.toJavaLocalDate(), estimate = false, month = false) }
    }
    schedule.targetDate?.let {
        return PlanEnd(it.toJavaLocalDate(), schedule.targetDateEstimated, schedule.targetDateNamedMonth)
    }
    val end = forecast as? PlanForecast.On ?: return null
    if (goalKind == LearnerSummaryGoal.Kind.EXAM || paused) return null
    return finishEnd(end.date)
}

/** Main's `isNearEstimate`: an estimate within six weeks of [today] is said by its day, a later one by its month. */
fun isNearEstimate(
    date: LocalDate,
    today: LocalDate,
): Boolean = abs(ChronoUnit.DAYS.between(today, date)) <= NEAR_ESTIMATE_DAYS

private fun Plan.isNearEstimate(date: LocalDate): Boolean = isNearEstimate(date, week.startDate.toJavaLocalDate())

/** Main's `getEstimatePrecision`: by its year when core dates it only by that, else by its day near and its month far. */
private fun Plan.estimateEnd(
    date: LocalDate,
    year: Boolean,
): PlanEnd = PlanEnd(date, estimate = true, month = !year && !isNearEstimate(date), year = year)

/** The plan's finish, said as precisely as core forecasts it. */
private fun Plan.finishEnd(date: LocalDate): PlanEnd =
    when (estimate.precision) {
        PlanFinishPrecision.YEAR -> PlanEnd(date, estimate = true, month = false, year = true)
        PlanFinishPrecision.MONTH -> PlanEnd(date, estimate = true, month = true)
        else -> estimateEnd(date, year = false)
    }

/**
 * Main's `getPhaseEnd`: the one date a phase is named by, wherever it shows: when it ends. A learning phase ends
 * when its lessons and challenge are done, so its end is an estimate while it's ahead, and while it's current with
 * its challenge (which has no booked day) still to come. A phase that ends on its challenge's day is an estimate too,
 * and so is every phase of a plan whose own date is one, since its phases are laid out back from it. A phase behind
 * the learner has none: its check says it.
 */
fun Plan.phaseEnd(phase: PlanPhase): PhaseEnd? {
    val short = phase.short
    if (short != null && shortPlan != null) return PhaseEnd.Days(short)
    if (phase.state == PlanPhase.State.DONE || phase.state == PlanPhase.State.UNFINISHED || phase.state == PlanPhase.State.LEFT_OUT) {
        return null
    }
    if (phase.later == true) return PhaseEnd.Later
    val challengeDay = phase.endingChallengeDay()
    // A phase is behind the learner on its challenge's day, which can come after its last lesson.
    val lastDay =
        challengeDay ?: phase.end ?: run {
            // A last phase without a day of its own ends with the plan.
            val last = phases.lastOrNull { it.kind != PlanPhase.Kind.AFTER_EXAM }?.index
            val planEnd = estimate.endDate?.toJavaLocalDate()?.takeIf { phase.index == last } ?: return null
            return finishEnd(planEnd)
        }
    val learns = phase.kind == PlanPhase.Kind.LEARN || phase.kind == PlanPhase.Kind.AFTER_EXAM
    val estimated =
        challengeDay != null ||
            schedule.targetDateEstimated ||
            (learns && (phase.state == PlanPhase.State.UPCOMING || phase.checkpoint?.state == PlanPhaseCheckpoint.State.UPCOMING))
    return if (estimated) phaseEstimate(phase, lastDay) else PlanEnd(lastDay, estimate = false, month = false)
}

/**
 * Main's `getPhaseEndPrecision`: a phase's estimated [day] ending where a plan without a date finishes is said as the
 * finish is; one ahead by how near it is; the one under way keeps its day unless core dates it by its year.
 */
private fun Plan.phaseEstimate(
    phase: PlanPhase,
    day: LocalDate,
): PlanEnd {
    val year = phase.precision == PlanFinishPrecision.YEAR
    return when {
        schedule.targetDate == null && estimate.precision != null && day == estimate.endDate?.toJavaLocalDate() -> finishEnd(day)
        phase.state == PlanPhase.State.UPCOMING || year -> estimateEnd(day, year)
        else -> PlanEnd(day, estimate = true, month = false)
    }
}

/** When a phase's challenge still ahead comes: "Later" while the phase's work has no place yet, else its day, said as the phase's end is. */
fun Plan.challengeDay(phase: PlanPhase): PhaseEnd? {
    val checkpoint = phase.checkpoint ?: return null
    if (checkpoint.later == true) return PhaseEnd.Later
    return checkpoint.date?.let { phaseEstimate(phase, it.toJavaLocalDate()) }
}

/** The day of a challenge still ahead that comes on or after the phase's last lesson. */
private fun PlanPhase.endingChallengeDay(): LocalDate? {
    val challengeDay = checkpoint?.takeIf { it.state == PlanPhaseCheckpoint.State.UPCOMING }?.date?.toJavaLocalDate()
    val end = end ?: return null
    return challengeDay?.takeUnless { it.isBefore(end) }
}

/**
 * Main's `getAxisDatedPhases`: the phases whose end the roadmap's axis dates, under the phase's end edge: the current
 * one and each after it, but not the last, whose place is the goal's date. A date says once where it falls: when
 * phases end on the same day only the last of them is dated, one that ends on the goal's day leaves it to the goal,
 * and any ending on the learner's [today] leaves it to "Today".
 */
fun Plan.axisDatedPhases(
    goalKind: LearnerSummaryGoal.Kind,
    today: LocalDate,
): Set<Long> {
    val drawn = roadmapPhases
    val current = drawn.indexOfFirst { it.state == PlanPhase.State.CURRENT }
    if (current == -1) return emptySet()
    val finish = finish(goalKind)?.date
    val dated =
        drawn.subList(current, maxOf(current, drawn.lastIndex)).mapNotNull { phase ->
            phaseEnd(phase)?.let { end -> phase.index to (if (end is PlanEnd) end.date else end) }
        }
    return dated
        .filterIndexed { position, (_, day) -> day != dated.getOrNull(position + 1)?.second && day != finish && day != today }
        .map { it.first }
        .toSet()
}

/**
 * Main's `getAxisFinish`: the goal's date under the axis. On the learner's [today], while a phase is under way,
 * "Today" already marks that day there, so the axis doesn't date it again; the list and the finish row still name it.
 */
fun Plan.axisFinish(
    goalKind: LearnerSummaryGoal.Kind,
    today: LocalDate,
): PlanEnd? = finish(goalKind)?.takeUnless { it.date == today && roadmapPhases.any { phase -> phase.state == PlanPhase.State.CURRENT } }

data class PlanOverrun(
    val phaseIndex: Long,
    val share: Float,
)

fun Plan.overrun(goalKind: LearnerSummaryGoal.Kind): PlanOverrun? {
    if (goalKind != LearnerSummaryGoal.Kind.EXAM && end != null) return null
    val finish = finish(goalKind) ?: return null
    val phases = roadmapPhases
    val last = phases.lastOrNull()?.end ?: return null
    if (!last.isAfter(finish.date)) return null
    val phase = phases.firstOrNull { it.end?.isBefore(finish.date) == false } ?: return null
    val share = phase.shareAt(finish.date, DayPart.End) ?: return null
    return PlanOverrun(phase.index, share)
}

private const val NEAR_ESTIMATE_DAYS = 42

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

fun chapterWindow(states: List<PlanPhaseChaptersInner.State>): IntRange {
    val current = states.indexOf(PlanPhaseChaptersInner.State.CURRENT)
    val focus = if (current == -1) states.indexOfFirst { it != PlanPhaseChaptersInner.State.DONE } else current
    val anchor = max(0, focus - 1)
    val start = max(0, min(anchor, states.size - SHOWN_CHAPTERS))
    return start until min(states.size, start + SHOWN_CHAPTERS)
}

private const val SHOWN_CHAPTERS = 4

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
