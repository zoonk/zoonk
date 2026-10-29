package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.util.UUID

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

@Composable
private fun fullCourseRule(
    course: FullCourse,
    today: LocalDate,
): String =
    if (course.isExam) {
        stringResource(R.string.plan_full_course_rule_exam)
    } else {
        stringResource(R.string.plan_full_course_rule_goal, goalDate(course.targetDate, course.targetDateNamedMonth, today))
    }

/** Main's `FullCourseSwitch`, under an exam's time a day. */
@Composable
internal fun FullCourseSwitch(
    page: PlanPageState,
    edits: PlanEdits,
    focus: FocusRequester,
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
                    .focusRequester(focus)
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

/** Main's `StudyEverything`: opens the sheet that says when it would end before the learner chooses it. */
@Composable
internal fun StudyEverythingAction(onOpen: () -> Unit) {
    FilledTonalButton(onClick = onOpen) { Text(stringResource(R.string.plan_study_everything)) }
}

/**
 * Main's `StudyEverythingHost` sheet. When the plan doesn't know when everything would end, the
 * sheet's opening (always the learner's tap) previews it; nothing is saved until they choose it.
 */
@Composable
internal fun StudyEverythingSheet(
    page: PlanPageState,
    edits: PlanEdits,
    preview: PlanPreviewState,
    onPreview: (List<PlanOp>) -> Unit,
    onDismiss: () -> Unit,
) {
    PlanSheet(onDismiss) { StudyEverythingBody(page, edits, preview, onPreview, onDone = onDismiss) }
}

@Composable
internal fun ColumnScope.StudyEverythingBody(
    page: PlanPageState,
    edits: PlanEdits,
    preview: PlanPreviewState,
    onPreview: (List<PlanOp>) -> Unit,
    onDone: () -> Unit,
) {
    var saved by rememberSaveable { mutableStateOf<UUID?>(null) }
    val save = saved
    val applied = save?.let(edits::sheetApplied)
    val course = fullCourse(page)
    val title = stringResource(R.string.plan_study_everything)
    val exam = course?.isExam ?: page.isExam
    val description =
        stringResource(if (exam) R.string.plan_study_everything_exam_description else R.string.plan_study_everything_goal_description)

    if (applied != null) {
        PlanChangeApplied(
            page,
            title,
            description,
            applied,
            R.drawable.ic_local_library,
            onUndo = { edits.undo(applied.change) },
            onDone = onDone,
        )
        return
    }
    if (course == null || (save != null && edits.sheetKept(save))) {
        LaunchedEffect(Unit) { onDone() }
        return
    }

    val operations = course.operations(true)
    val pending = edits.isPending(PlanPart.FullCourse)
    val asking = !pending && course.endDate == null
    val shown = preview.of(operations, page.plan)
    val endDate =
        course.endDate ?: (shown as? PlanPreviewState.Ready)
            ?.preview
            ?.effect
            ?.endDateAfter
            ?.toJavaLocalDate()
    val finish = finishText(course, endDate, page)

    LaunchedEffect(asking, page.plan) {
        if (asking && preview.of(operations, page.plan) == PlanPreviewState.Idle) onPreview(operations)
    }

    fun choose() {
        val id = UUID.randomUUID()
        saved = id
        edits.change(PlanPart.FullCourse, operations) { edits.answerSheet(id, it) }
    }

    PlanSheetContent(
        title = title,
        description = description,
        body = {
            finish?.let { Text(it, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium) }
            if (asking && shown is PlanPreviewState.Loading) {
                Text(
                    text = stringResource(R.string.plan_checking_changes),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                fullCourseRule(course, page.today),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        actions = {
            Button(onClick = ::choose, modifier = Modifier.fillMaxWidth()) {
                PendingLabel(pending, stringResource(R.string.plan_study_everything))
            }
            TextButton(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.plan_cancel)) }
            if (save != null && edits.sheetFailed(PlanPart.FullCourse, save)) SaveFailedText()
        },
    )
}
