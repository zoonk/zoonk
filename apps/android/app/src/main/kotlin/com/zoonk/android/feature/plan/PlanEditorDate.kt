package com.zoonk.android.feature.plan

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import kotlinx.datetime.toJavaLocalDate
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Main's `PlanDate`. A month the learner named stays a month until they pick its day, so the field
 * starts empty instead of showing a day they never chose.
 */
@Composable
internal fun PlanDateSection(
    page: PlanPageState,
    edits: PlanEdits,
    drafts: EditorDrafts,
    modifier: Modifier = Modifier,
) {
    val schedule = page.plan.schedule
    val target = schedule.targetDate?.toJavaLocalDate()
    val namedMonth = schedule.targetDateNamedMonth && target != null
    val asked = edits.asked(PlanPart.Date).filterIsInstance<PlanOp.TargetDate>().firstOrNull()
    val shown = if (asked != null) asked.date else target.takeUnless { namedMonth }
    val locale = currentLocale()

    fun setDate(date: LocalDate) = edits.change(PlanPart.Date, listOf(PlanOp.TargetDate(date))) {}

    val note =
        when {
            target != null && namedMonth -> stringResource(R.string.plan_named_month_note, formatDate(target, locale, DateStyle.Month))
            target == null && !page.isExam -> stringResource(R.string.plan_no_deadline_note)
            else -> null
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = shown?.let { formatDate(it, locale, DateStyle.Long) }.orEmpty(),
            onValueChange = {},
            modifier =
                Modifier.fillMaxWidth().pointerInput(Unit) {
                    awaitEachGesture {
                        awaitFirstDown(pass = PointerEventPass.Initial)
                        if (waitForUpOrCancellation(pass = PointerEventPass.Initial) != null) drafts.datePicking = true
                    }
                },
            readOnly = true,
            label = { Text(stringResource(if (page.isExam) R.string.plan_exam_date else R.string.plan_deadline)) },
            trailingIcon = {
                IconButton(onClick = { drafts.datePicking = true }) {
                    Icon(painterResource(R.drawable.ic_calendar_month), contentDescription = stringResource(R.string.plan_pick_date))
                }
            },
            supportingText = note?.let { { Text(it) } },
            singleLine = true,
        )

        schedule.noticeDay?.let { day ->
            Text(
                text = noticeDayText(day.date.toJavaLocalDate(), day.estimated, page.plan.examDocument),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            FilledTonalButton(onClick = { setDate(day.date.toJavaLocalDate()) }) {
                Text(stringResource(R.string.plan_use_this_date))
            }
        }

        if (edits.hasFailed(PlanPart.Date)) SaveFailedText()
    }

    if (drafts.datePicking) {
        TargetDateDialog(
            today = page.today,
            shown = shown ?: target,
            canPick = { namedMonth || it != target },
            onPick = {
                drafts.datePicking = false
                setDate(it)
            },
            onDismiss = { drafts.datePicking = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TargetDateDialog(
    today: LocalDate,
    shown: LocalDate?,
    canPick: (LocalDate) -> Boolean,
    onPick: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val bounds = today.plusDays(1)..today.plusDays(MAX_PLAN_DAYS)
    val state =
        rememberDatePickerState(
            initialSelectedDateMillis = shown?.takeIf { it in bounds }?.utcMillis,
            initialDisplayedMonthMillis = (shown ?: bounds.start).utcMillis,
            yearRange = bounds.start.year..bounds.endInclusive.year,
            selectableDates =
                object : SelectableDates {
                    override fun isSelectableDate(utcTimeMillis: Long) = utcDate(utcTimeMillis) in bounds

                    override fun isSelectableYear(year: Int) = year in bounds.start.year..bounds.endInclusive.year
                },
        )
    val chosen = state.selectedDateMillis?.let(::utcDate)?.takeIf { it in bounds && canPick(it) }

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { chosen?.let(onPick) }, enabled = chosen != null) { Text(stringResource(R.string.plan_save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.plan_cancel)) } },
    ) {
        DatePicker(state)
    }
}

/** Plans reach at most this far ahead, as core's `getTargetDateBounds`. */
private const val MAX_PLAN_DAYS = 3650L

/** The date picker counts days as UTC midnights. */
private val LocalDate.utcMillis: Long get() = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

private fun utcDate(millis: Long): LocalDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
