package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.Switch
import com.zoonk.api.models.PlanFinishPrecision
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.util.UUID

/** Main's `useFinishSentence`: when a plan that studies past its exam finishes, "January 2027" or, far off, "2031". */
@Composable
internal fun finishText(
    endDate: LocalDate?,
    precision: PlanFinishPrecision?,
): String? {
    endDate ?: return null
    val shown = EndDate(endDate, if (precision == PlanFinishPrecision.YEAR) EndPrecision.Year else EndPrecision.Month)
    return stringResource(R.string.plan_finish_around, endDateText(shown))
}

/**
 * Main's `FullCourseSwitch`, under an exam's time a day: only on a plan that already studies past the exam, so it can be
 * turned off. Before the exam the option lives in the coverage suggestion; after it, the Plan asks.
 */
@Composable
internal fun FullCourseSwitch(
    page: PlanPageState,
    edits: PlanEdits,
    focus: FocusRequester,
) {
    val course = fullCourse(page)?.takeIf { it.isExam && it.on } ?: return
    val finish = finishText(course.endDate, course.precision)
    val on =
        edits
            .asked(PlanPart.FullCourse)
            .filterIsInstance<PlanOp.FullCourse>()
            .firstOrNull()
            ?.fullCourse ?: course.on

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
                        onValueChange = { edits.change(PlanPart.FullCourse, course.operations(it), null) },
                    ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.plan_full_course_switch), Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            Switch(checked = on, onCheckedChange = null)
        }
        finish?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (edits.hasFailed(PlanPart.FullCourse)) SaveFailedText()
    }
}

/** Main's `StudyEverything`: opens the sheet that says when it would end before the learner chooses it. */
@Composable
internal fun StudyEverythingAction(onOpen: () -> Unit) {
    OutlinedButton(onClick = onOpen) { Text(stringResource(R.string.plan_study_everything)) }
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
    val exam = course?.isExam ?: page.isExam
    val title = stringResource(if (exam) R.string.plan_study_everything_after_exam else R.string.plan_study_everything)
    val description =
        stringResource(
            when {
                exam && page.subjectsTakenOut -> R.string.plan_study_everything_exam_in_plan_description
                exam -> R.string.plan_study_everything_exam_description
                page.subjectsTakenOut -> R.string.plan_study_everything_goal_in_plan_description
                else -> R.string.plan_study_everything_goal_description
            },
        )

    if (applied != null) {
        PlanChangeApplied(
            page,
            title,
            description,
            applied,
            R.drawable.ic_library,
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
    val result = (shown as? PlanPreviewState.Ready)?.preview
    val finish =
        if (course.endDate != null) {
            finishText(course.endDate, course.precision)
        } else {
            finishText(
                (result?.finishDate ?: result?.effect?.endDateAfter)?.toJavaLocalDate(),
                result?.precision ?: result?.effect?.endPrecisionAfter,
            )
        }

    LaunchedEffect(asking, page.plan) {
        if (asking && preview.of(operations, page.plan) == PlanPreviewState.Idle) onPreview(operations)
    }

    fun choose() {
        val id = UUID.randomUUID()
        saved = id
        edits.change(PlanPart.FullCourse, operations, PlanAsker.Sheet(id))
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
        },
        actions = {
            Button(
                busy = pending,
                onClick = ::choose,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(stringResource(if (exam) R.string.plan_keep_studying else R.string.plan_study_everything)) }
            OutlinedButton(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.plan_cancel)) }
            if (save != null && edits.sheetFailed(PlanPart.FullCourse, save)) SaveFailedText()
        },
    )
}
