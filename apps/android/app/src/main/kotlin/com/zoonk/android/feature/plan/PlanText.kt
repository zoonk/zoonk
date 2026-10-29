package com.zoonk.android.feature.plan

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.ShortExamFocus
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** A day of the plan as written ("Nov 3") and as read aloud, which says "about" for an estimate. */
data class PlanDateWords(
    val text: String,
    val spoken: String,
)

@Composable
fun planDate(
    date: LocalDate,
    today: LocalDate,
    estimate: Boolean = false,
    month: Boolean = false,
): PlanDateWords {
    val formatted = formatPlanDate(date, today, currentLocale(), month)
    return if (estimate) {
        PlanDateWords(stringResource(R.string.plan_date_estimate, formatted), stringResource(R.string.plan_date_estimate_spoken, formatted))
    } else {
        PlanDateWords(formatted, formatted)
    }
}

/** Main's `usePhaseName`: exam phases have no name, so they're named by kind. */
@Composable
fun phaseName(
    phase: PlanPhase,
    mocksRequirePlus: Boolean,
    byPlace: Boolean = false,
): String {
    val number = (phase.index + 1).toInt()
    val short = phase.short
    return when {
        byPlace -> stringResource(R.string.plan_phase_number, number)
        phase.name.isNotEmpty() -> phase.name
        short != null -> shortFocusName(short.focus, mocksRequirePlus)
        else -> phaseKindName(phase.kind, number)
    }
}

@Composable
private fun phaseKindName(
    kind: PlanPhase.Kind,
    number: Int,
): String =
    when (kind) {
        PlanPhase.Kind.FOUNDATIONS -> stringResource(R.string.plan_phase_foundations)
        PlanPhase.Kind.GAPS -> stringResource(R.string.plan_phase_gaps)
        PlanPhase.Kind.PRACTICE -> stringResource(R.string.plan_phase_practice)
        PlanPhase.Kind.FINAL_STRETCH -> stringResource(R.string.plan_phase_final_stretch)
        PlanPhase.Kind.AFTER_EXAM -> stringResource(R.string.plan_phase_after_exam)
        PlanPhase.Kind.LEARN -> stringResource(R.string.plan_phase_number, number)
    }

@Composable
fun shortFocusName(
    focus: ShortExamFocus,
    mocksRequirePlus: Boolean,
): String =
    when (focus) {
        ShortExamFocus.MAP_AND_GAPS -> {
            stringResource(R.string.plan_short_map_and_gaps)
        }

        ShortExamFocus.PRACTICE -> {
            stringResource(R.string.plan_phase_practice)
        }

        ShortExamFocus.MOCK_AND_PRACTICE -> {
            stringResource(if (mocksRequirePlus) R.string.plan_short_full_review_and_practice else R.string.plan_short_mock_and_practice)
        }

        ShortExamFocus.MOCK_AND_REVIEW -> {
            stringResource(if (mocksRequirePlus) R.string.plan_short_full_review else R.string.plan_short_mock_and_review)
        }

        ShortExamFocus.LIGHT_REVIEW -> {
            stringResource(R.string.plan_short_light_review)
        }
    }

/** For a plan of a few days: which of them a phase takes. */
@Composable
fun shortDays(
    plan: Plan,
    phase: PlanPhase,
): String? {
    val short = phase.short ?: return null
    val days = plan.shortPlan?.days?.toInt() ?: return null
    val first = short.firstDay.toInt()
    val last = short.lastDay.toInt()
    return if (first == last) {
        stringResource(R.string.plan_short_day, first, days)
    } else {
        stringResource(R.string.plan_short_days, first, last, days)
    }
}

/** Core leaves the title empty for lessons being written in the goal's own course. */
@Composable
fun chapterTitle(chapter: PlanPhaseChaptersInner): String =
    when {
        chapter.skills.isNotEmpty() -> pluralStringResource(R.plurals.plan_skills_you_know, chapter.skills.size, chapter.skills.size)
        chapter.title.isNotEmpty() -> chapter.title
        else -> stringResource(R.string.plan_more_lessons)
    }

/** The line under a chapter row: lessons on the way, a far topic's lessons and start, a skip, or going deeper. */
@Composable
fun chapterLine(chapter: PlanPhaseChaptersInner): String? =
    when {
        chapter.writing && chapter.far -> farTopicLine(chapter.plannedLessons?.toInt(), chapter.nextDate?.toJavaLocalDate())
        chapter.writing -> stringResource(R.string.plan_lessons_on_the_way)
        chapter.testedOut && chapter.skills.isEmpty() -> stringResource(R.string.plan_skipped_known)
        chapter.deeper -> stringResource(R.string.plan_going_deeper)
        else -> null
    }

/** Main's `useFarTopicLine`: about how many lessons, and from when (the day this month, else the month). */
@Composable
fun farTopicLine(
    lessons: Int?,
    nextDate: LocalDate?,
    today: LocalDate = LocalDate.now(),
): String? {
    val start =
        nextDate?.let {
            val locale = currentLocale()
            when {
                it.year == today.year && it.month == today.month -> formatDay(it, "MMMd", locale)
                it.year == today.year -> formatDay(it, "MMMM", locale)
                else -> formatDay(it, "yMMMM", locale)
            }
        }
    if (lessons == null) return start?.let { stringResource(R.string.plan_far_from, it) }
    val count =
        if (lessons == 1) {
            stringResource(R.string.plan_far_one_lesson, lessons)
        } else {
            pluralStringResource(R.plurals.plan_far_lessons_about, lessons, lessons)
        }
    return start?.let { stringResource(R.string.plan_far_count_from, count, it) } ?: count
}

@Composable
fun lessonsDoneSpoken(
    done: Long,
    total: Long,
): String = pluralStringResource(R.plurals.plan_lessons_done_of, total.toInt(), done.toInt(), total.toInt())
