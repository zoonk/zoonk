package com.zoonk.android.feature.exam

import android.text.format.DateFormat
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatTimeOfDay
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamDay
import com.zoonk.api.models.ExamMoment
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalTime

/**
 * Main's `ExamMomentCard`: what the exam being close means for today, the exam day's checklist,
 * and the way to the exam page ([onOpen], none when it's already there). Empty once a reported
 * result leaves nothing to say.
 */
@Composable
fun ExamMomentCard(
    moment: ExamMoment,
    onOpen: (() -> Unit)?,
    modifier: Modifier = Modifier,
    titleStyle: TextStyle = MaterialTheme.typography.titleSmall,
) {
    val body = momentBody(moment) ?: return
    val afterExam = moment.stage == ExamMoment.Stage.AFTER_EXAM

    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                painter = painterResource(moment.stage.icon),
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(examMomentTitle(moment), Modifier.semantics { heading() }, style = titleStyle)
                moment.day?.takeUnless { afterExam }?.let {
                    Text(examDayText(it), style = MaterialTheme.typography.bodyMedium.withTabularFigures())
                }
                Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }

        ExamChecklist(moment.checklist, moment.tools)

        onOpen?.let {
            OutlinedButton(onClick = it) {
                Text(stringResource(if (afterExam) R.string.exam_add_result else R.string.exam_see_exam))
            }
        }
    }
}

@Composable
fun examMomentTitle(moment: ExamMoment): String =
    when (moment.stage) {
        ExamMoment.Stage.FINAL_STRETCH -> stringResource(R.string.exam_final_stretch)
        ExamMoment.Stage.DAY_BEFORE -> stringResource(R.string.exam_tomorrow, moment.examName)
        ExamMoment.Stage.EXAM_DAY -> stringResource(R.string.exam_today, moment.examName)
        ExamMoment.Stage.AFTER_EXAM -> stringResource(R.string.exam_how_did_it_go)
    }

@get:DrawableRes
val ExamMoment.Stage.icon: Int
    get() =
        when (this) {
            ExamMoment.Stage.FINAL_STRETCH -> R.drawable.ic_flag
            ExamMoment.Stage.DAY_BEFORE -> R.drawable.ic_bedtime
            ExamMoment.Stage.EXAM_DAY -> R.drawable.ic_event_upcoming
            ExamMoment.Stage.AFTER_EXAM -> R.drawable.ic_contact_support
        }

/** The year always shows: the learner may prepare for an edition years ahead. */
@Composable
fun examDayText(day: ExamDay): String {
    val locale = currentLocale()
    val date = formatDate(day.date.toJavaLocalDate(), locale, DateStyle.WeekdayDayYear)
    val start = day.startTime ?: return date
    val time = formatTimeOfDay(LocalTime.parse(start), locale, DateFormat.is24HourFormat(LocalContext.current))
    return stringResource(R.string.exam_day_time, date, time)
}

@Composable
private fun momentBody(moment: ExamMoment): String? =
    when (moment.stage) {
        ExamMoment.Stage.FINAL_STRETCH -> {
            stringResource(R.string.exam_final_stretch_detail)
        }

        ExamMoment.Stage.DAY_BEFORE -> {
            val work = workLine(moment)
            when (moment.dayBefore) {
                ExamMoment.DayBefore.MOCK -> stringResource(R.string.exam_day_before_mock, work)
                ExamMoment.DayBefore.LEARN_AND_MOCK -> stringResource(R.string.exam_day_before_learn_and_mock)
                ExamMoment.DayBefore.LEARN -> stringResource(R.string.exam_day_before_learn)
                ExamMoment.DayBefore.REVIEW -> stringResource(R.string.exam_day_before_review, work)
                ExamMoment.DayBefore.LIGHT -> stringResource(R.string.exam_day_before_light, work)
            }
        }

        ExamMoment.Stage.EXAM_DAY -> {
            workLine(moment)
        }

        ExamMoment.Stage.AFTER_EXAM -> {
            if (moment.resultReported) null else stringResource(R.string.exam_add_result_detail)
        }
    }

@Composable
private fun workLine(moment: ExamMoment): String {
    val sessions = moment.sessionsDone.toInt()
    val mocks = moment.mocksTaken.toInt()
    val done =
        if (mocks > 0) {
            stringResource(
                R.string.exam_work_sessions_and_mocks,
                pluralStringResource(R.plurals.exam_sessions, sessions, sessions),
                pluralStringResource(R.plurals.exam_mocks, mocks, mocks),
            )
        } else {
            pluralStringResource(R.plurals.exam_work_sessions, sessions, sessions)
        }
    return if (moment.prepared) "$done ${stringResource(R.string.exam_prepared)}" else done
}

/** Nothing is saved: it's a calm reminder, never a test. */
@Composable
private fun ExamChecklist(
    items: List<ExamMoment.Checklist>,
    tools: List<String>,
) {
    if (items.isEmpty()) return
    var done by remember(items) { mutableStateOf(emptySet<ExamMoment.Checklist>()) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text(
                stringResource(R.string.exam_checklist_title),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleSmall,
            )
            Text(
                text = stringResource(R.string.exam_checklist_count, done.size, items.size),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }

        Column {
            items.forEachIndexed { index, item ->
                if (index > 0) HorizontalDivider()
                val checked = item in done
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .toggleable(checked, role = Role.Checkbox) { done = if (it) done + item else done - item }
                            .heightIn(min = 48.dp)
                            .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = checked, onCheckedChange = null)
                    Text(
                        text = checklistLabel(item),
                        color = if (checked) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        if (tools.isNotEmpty()) {
            Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.exam_tools_title), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                tools.forEach {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun checklistLabel(item: ExamMoment.Checklist): String =
    stringResource(
        when (item) {
            ExamMoment.Checklist.DOCUMENTS -> R.string.exam_checklist_documents
            ExamMoment.Checklist.BLACK_PEN -> R.string.exam_checklist_black_pen
            ExamMoment.Checklist.ROUTE -> R.string.exam_checklist_route
            ExamMoment.Checklist.EXAM_TIME -> R.string.exam_checklist_exam_time
            ExamMoment.Checklist.SLEEP -> R.string.exam_checklist_sleep
            ExamMoment.Checklist.MATERIALS -> R.string.exam_checklist_materials
        },
    )
