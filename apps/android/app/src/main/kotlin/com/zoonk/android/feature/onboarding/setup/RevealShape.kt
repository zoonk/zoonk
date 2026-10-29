package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFeasibility
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.SyllabusSubjectDisplayWeight
import com.zoonk.api.models.SyllabusTopic
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt

/** Main's `RevealFacts`: how long the plan runs, the time a day, and the study it adds up to. */
internal data class RevealFacts(
    /** Days to the goal's date; null without one. */
    val days: Int?,
    val daysEstimated: Boolean,
    /** Without a date: when the plan ends at this pace. */
    val end: LocalDate?,
    /** The end is far off, so it reads as a month, never "October" in October. */
    val endAsMonth: Boolean,
    val dailyMinutes: Int,
    /** Rounded as "about" says; 0 when there's nothing to say. */
    val studyMinutes: Int,
)

internal fun Plan.revealFacts(today: LocalDate): RevealFacts {
    val targetDate = schedule.targetDate?.toJavaLocalDate()
    val end = estimate.endDate?.toJavaLocalDate().takeIf { targetDate == null }
    val study = numbers?.let { if (it.context.targetDate == null) it.scheduledMinutes else it.beforeDeadlineMinutes } ?: 0.0

    return RevealFacts(
        days =
            targetDate?.let {
                ChronoUnit.DAYS
                    .between(today, it)
                    .toInt()
                    .coerceAtLeast(0)
            },
        daysEstimated = schedule.targetDateEstimated,
        end = end,
        endAsMonth = end != null && ChronoUnit.DAYS.between(week.startDate.toJavaLocalDate(), end) > NEAR_ESTIMATE_DAYS,
        dailyMinutes = schedule.dailyMinutes.toInt(),
        studyMinutes = roundStudyMinutes(study),
    )
}

private fun roundStudyMinutes(minutes: Double): Int =
    if (minutes >= ROUND_TO_HOURS_FROM) {
        (minutes / MINUTES_PER_HOUR).roundToInt() * MINUTES_PER_HOUR
    } else {
        (minutes / MINUTES_STEP).roundToInt() * MINUTES_STEP
    }

/** The phases a new plan shows: what comes after the exam isn't part of it. */
internal val Plan.revealPhases get() = phases.filter { it.kind != PlanPhase.Kind.AFTER_EXAM }

/** The phases drawn in time, without those the plan holds none of. */
internal val Plan.roadmapPhases get() = revealPhases.filter { it.state != PlanPhase.State.LEFT_OUT }

/** Days when it has dates, else hours, so every drawing of the phases shares one scale: time. */
internal fun PlanPhase.weight(): Float = days()?.toFloat() ?: hours.toFloat().coerceAtLeast(1f)

internal data class PhaseDay(
    val day: Int,
    val days: Int,
)

internal fun PlanPhase.dayOf(today: LocalDate): PhaseDay? {
    val days = days() ?: return null
    val start = startDate?.toJavaLocalDate() ?: return null
    return PhaseDay((ChronoUnit.DAYS.between(start, today).toInt() + 1).coerceIn(1, days), days)
}

/** Both its first and last day count: the planner's end date is its last day. */
private fun PlanPhase.days(): Int? {
    val start = startDate?.toJavaLocalDate() ?: return null
    val end = endDate?.toJavaLocalDate() ?: return null
    return (ChronoUnit.DAYS.between(start, end).toInt() + 1).coerceAtLeast(1)
}

/** A plan of one phase has nothing to draw in time: its chapters say its shape, without the ones still being written ahead. */
internal fun Plan.revealChapters(): List<PlanPhaseChaptersInner> =
    revealPhases
        .takeIf { it.size < 2 }
        ?.flatMap { it.chapters }
        ?.filterNot { it.writing && !it.far && it.skills.isEmpty() }
        .orEmpty()

internal sealed interface RevealCoverage {
    data object FreeWeekOver : RevealCoverage

    data class Covered(
        val feasibility: PlanFeasibility,
        val fullCourse: Boolean,
    ) : RevealCoverage

    /** [end] is when the learner finishes everything, after the exam; null when the plan doesn't say. */
    data class FullCourse(
        val end: LocalDate?,
    ) : RevealCoverage

    data class Summary(
        val title: SummaryTitle,
        val detail: SummaryDetail?,
    ) : RevealCoverage
}

/** Main's `RevealCoverage`: what the learner's time covers, or the syllabus the plan follows when it covers everything. */
internal fun revealCoverage(
    plan: Plan,
    goalKind: Goal.Kind,
    syllabus: Syllabus?,
): RevealCoverage? {
    if (plan.access.freeWeekOver) return RevealCoverage.FreeWeekOver

    val feasibility = plan.feasibility?.takeIf { it.deadline != null && !it.fits }

    if (feasibility != null) {
        val isExam = goalKind == Goal.Kind.EXAM
        return if (isExam && plan.schedule.fullCourse && plan.schedule.targetDate != null) {
            RevealCoverage.FullCourse(plan.estimate.fullCourseEndDate?.toJavaLocalDate())
        } else {
            RevealCoverage.Covered(feasibility, fullCourse = plan.schedule.fullCourse)
        }
    }

    return syllabus?.takeIf { goalKind != Goal.Kind.LANGUAGE && (it.kind == Syllabus.Kind.NOTICE || it.subjects.size > 1) }?.summary()
}

internal sealed interface SummaryTitle {
    data class Modules(
        val count: Int,
    ) : SummaryTitle

    data class MaterialTopics(
        val count: Int,
    ) : SummaryTitle

    data class Subjects(
        val count: Int,
        val document: ExamDocument,
    ) : SummaryTitle
}

internal sealed interface SummaryDetail {
    data class Names(
        val names: List<String>,
    ) : SummaryDetail

    /** Each subject's short name with its questions in the exam. */
    data class MostQuestions(
        val subjects: List<Pair<String, Long>>,
    ) : SummaryDetail

    data class Topics(
        val count: Int,
    ) : SummaryDetail

    data class AllPlanned(
        val total: Int,
    ) : SummaryDetail

    data class DontFit(
        val leftOut: Int,
        val total: Int,
    ) : SummaryDetail

    data class Planned(
        val planned: Int,
        val total: Int,
    ) : SummaryDetail
}

/** Main's `useSummaryLines`: the syllabus in a line, and how much of it the plan holds. */
private fun Syllabus.summary(): RevealCoverage.Summary {
    val noticeSubjects = subjects.count { it.source == SyllabusSubject.Source.NOTICE }
    val firstNames = SummaryDetail.Names(subjects.take(2).map { it.shortName })
    val topics = topicCount.toInt()

    if (kind != Syllabus.Kind.NOTICE) return RevealCoverage.Summary(SummaryTitle.Modules(subjects.size), firstNames)

    // Material is never called a notice; one that lists only headings counts them as its topics.
    if (fromMaterial) {
        val title = SummaryTitle.MaterialTopics(if (topics > 0) topics else noticeSubjects)
        return RevealCoverage.Summary(title, if (topics == 0) firstNames else coverageDetail().takeIf { topicsMapped })
    }

    val title = SummaryTitle.Subjects(noticeSubjects, examDocument)
    val detail =
        when {
            // A notice that names its subjects without listing their topics (the OAB's first phase).
            topics == 0 -> mostQuestions() ?: firstNames

            !topicsMapped -> SummaryDetail.Topics(topics)

            else -> coverageDetail()
        }
    return RevealCoverage.Summary(title, detail)
}

private fun Syllabus.mostQuestions(): SummaryDetail? {
    val notice = subjects.filter { it.source == SyllabusSubject.Source.NOTICE }
    val counted = notice.mapNotNull { subject -> subject.questions?.let { subject.shortName to it } }
    return SummaryDetail.MostQuestions(counted.take(HEAVIEST_SHOWN)).takeIf { counted.isNotEmpty() && counted.size == notice.size }
}

/** A subject's basics the learner starts past aren't left out: the plan counts them as known. */
private fun Syllabus.coverageDetail(): SummaryDetail {
    val total = topicCount.toInt()
    val out =
        subjects.flatMap { it.topics }.filter {
            it.status == SyllabusTopic.Status.NOT_PLANNED && it.notPlannedReason != SyllabusTopic.NotPlannedReason.PAST_BASICS
        }
    return when {
        out.isEmpty() -> SummaryDetail.AllPlanned(total)
        out.all { it.notPlannedReason == SyllabusTopic.NotPlannedReason.TIME } -> SummaryDetail.DontFit(out.size, total)
        else -> SummaryDetail.Planned(total - out.size, total)
    }
}

internal data class AreaWeight(
    val key: String,
    val name: String,
    val share: Float,
    val percent: Long,
    val assumed: Boolean,
)

internal enum class WeightSource { Material, Guide, Notice }

internal data class AreaWeights(
    val areas: List<AreaWeight>,
    val source: WeightSource,
) {
    val assumed get() = areas.count { it.assumed }
}

/** Main's `AreaWeights`, heaviest first; null below two areas, which have nothing to compare. */
internal fun Syllabus.areaWeights(): AreaWeights? {
    val areas =
        subjects
            .mapNotNull { subject ->
                subject.displayWeight?.let {
                    AreaWeight(
                        subject.key,
                        subject.name,
                        it.share.toFloat(),
                        it.percent,
                        assumed =
                            it.basis == SyllabusSubjectDisplayWeight.Basis.ASSUMED,
                    )
                }
            }.sortedByDescending { it.share }
    val source =
        when {
            fromMaterial -> WeightSource.Material
            examDocument == ExamDocument.GUIDE -> WeightSource.Guide
            else -> WeightSource.Notice
        }
    return AreaWeights(areas, source).takeIf { areas.size >= 2 }
}

private const val NEAR_ESTIMATE_DAYS = 42
private const val ROUND_TO_HOURS_FROM = 120.0
private const val MINUTES_PER_HOUR = 60
private const val MINUTES_STEP = 5
private const val HEAVIEST_SHOWN = 3
