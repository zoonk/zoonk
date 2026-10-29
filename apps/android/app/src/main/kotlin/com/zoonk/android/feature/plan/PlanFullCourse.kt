package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/**
 * Main's `useFullCourse`: studying everything, an exam's past its date and another goal's without
 * one. [endDate] only when it's the plan's own end: working it out otherwise plans the goal again,
 * which a page never does.
 */
@Immutable
internal data class FullCourse(
    val isExam: Boolean,
    val on: Boolean,
    val endDate: LocalDate?,
    val targetDate: LocalDate,
    val targetDateNamedMonth: Boolean,
) {
    fun operations(on: Boolean): List<PlanOp> = if (isExam) listOf(PlanOp.FullCourse(on)) else listOf(PlanOp.TargetDate(null))
}

/** Null when there's nothing to choose. */
internal fun fullCourse(page: PlanPageState): FullCourse? {
    val plan = page.plan
    val schedule = plan.schedule
    val target = schedule.targetDate ?: return null
    val fits = plan.feasibility?.fits ?: false
    if (page.goal.kind == LearnerSummaryGoal.Kind.EXPLAIN || (page.isExam && fits && !schedule.fullCourse)) return null
    val end = if (page.isExam) plan.estimate.fullCourseEndDate else plan.estimate.endDate.takeIf { fits }
    return FullCourse(page.isExam, schedule.fullCourse, end?.toJavaLocalDate(), target.toJavaLocalDate(), schedule.targetDateNamedMonth)
}

/** Names the exam's year beside the finish's, so November 2027 never reads as the exam's month. */
@Composable
private fun finishText(
    course: FullCourse,
    endDate: LocalDate?,
    page: PlanPageState,
): String? {
    endDate ?: return null
    val locale = currentLocale()
    val month = formatDate(endDate, locale, DateStyle.Month, page.today)
    val time =
        formatMinutes(
            page.plan.schedule.dailyMinutes
                .toInt(),
            locale,
        )
    return if (course.isExam) {
        stringResource(
            R.string.plan_finish_after_exam,
            time,
            month,
            goalDate(course.targetDate, course.targetDateNamedMonth, page.today, DateStyle.LongYear),
        )
    } else {
        stringResource(R.string.plan_finish, time, month)
    }
}

/** Main's `FullCourseSwitch`, under an exam's time a day. */
@Composable
internal fun FullCourseSwitch(
    page: PlanPageState,
    edits: PlanEdits,
) {
    val course = fullCourse(page)?.takeIf { it.isExam } ?: return
    val on =
        edits
            .asked(PlanPart.FullCourse)
            .filterIsInstance<PlanOp.FullCourse>()
            .firstOrNull()
            ?.fullCourse ?: course.on
    val finish = finishText(course, course.endDate, page)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(
                        value = on,
                        role = Role.Switch,
                        onValueChange = { edits.change(PlanPart.FullCourse, course.operations(it)) {} },
                    ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.plan_full_course_switch), Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            Switch(checked = on, onCheckedChange = null)
        }
        Text(
            text =
                when {
                    !course.on -> stringResource(R.string.plan_full_course_off)
                    finish != null -> stringResource(R.string.plan_full_course_on_exam, finish)
                    else -> stringResource(R.string.plan_full_course_on_exam_unknown_end)
                },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (edits.hasFailed(PlanPart.FullCourse)) SaveFailedText()
    }
}
