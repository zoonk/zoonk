package com.zoonk.android.feature.exam

import android.icu.text.ListFormatter
import android.text.format.DateFormat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.feature.plan.formatPlanDate
import com.zoonk.android.feature.plan.noticeDayText
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatTimeOfDay
import com.zoonk.android.ui.format.parseLocalizedNumber
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.ExamMoment
import com.zoonk.api.models.ExamResult
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.ExamViewScoring
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

@Composable
internal fun ExamEyebrow(exam: ExamView) {
    val days = exam.daysLeft?.takeIf { it > 0 }?.toInt()
    val style = MaterialTheme.typography.labelLarge
    val color = MaterialTheme.colorScheme.onSurfaceVariant

    when {
        days == null -> {
            Text(stringResource(R.string.exam_eyebrow), color = color, style = style)
        }

        exam.daysEstimated -> {
            val spoken = pluralStringResource(R.plurals.exam_eyebrow_days_left_about, days, days)
            Text(
                text = pluralStringResource(R.plurals.exam_eyebrow_days_left_estimated, days, days),
                modifier = Modifier.semantics { contentDescription = spoken },
                color = color,
                style = style,
            )
        }

        else -> {
            Text(pluralStringResource(R.plurals.exam_eyebrow_days_left, days, days), color = color, style = style)
        }
    }
}

/** Main's `useExamDays`: the exam's days with their start time, and whether they're estimated. */
@Composable
internal fun examFacts(exam: ExamView): List<String> {
    val locale = currentLocale()
    val is24Hour = DateFormat.is24HourFormat(LocalContext.current)
    val today = LocalDate.now()
    val startTimes = exam.days.map { it.startTime }.toSet()
    val sharedTime =
        exam.days
            .firstOrNull()
            ?.startTime
            ?.takeIf { startTimes.size == 1 }
    val time = { start: String -> formatTimeOfDay(LocalTime.parse(start), locale, is24Hour) }

    if (exam.namedMonth) {
        return exam.days.map { day ->
            formatDate(day.date.toJavaLocalDate(), locale, DateStyle.Month).replaceFirstChar { it.titlecase(locale) }
        }
    }

    val days =
        exam.days.map { day ->
            val date = day.date.toJavaLocalDate()
            val text = if (exam.days.size == 1) examDayDate(date, today, locale) else formatPlanDate(date, today, locale)
            val start = day.startTime?.takeIf { sharedTime == null }
            if (start != null) stringResource(R.string.exam_day_time, text, time(start)) else text
        }
    val dates = if (startTimes.size <= 1 && days.size > 1) listOf(ListFormatter.getInstance(locale).format(days)) else days
    val withTime = if (sharedTime != null) dates + time(sharedTime) else dates
    val estimated = stringResource(R.string.exam_estimated_from_past).takeIf { exam.daysEstimated }
    return withTime + listOfNotNull(estimated)
}

/** "Sat, Nov 8": main's `useExamDayDate`. */
internal fun examDayDate(
    date: LocalDate,
    today: LocalDate,
    locale: Locale,
): String = "${formatDate(date, locale, DateStyle.WeekdayShort)}, ${formatPlanDate(date, today, locale)}"

/** Main's date note under the aside: where the date comes from while it isn't official. */
internal val ExamView.dateNote: Int?
    get() {
        val notice = examDocument == ExamDocument.NOTICE
        return when {
            days.isEmpty() -> null
            namedMonth && (noticeDay != null || noSitting != null) -> null
            namedMonth -> if (notice) R.string.exam_named_month_note_notice else R.string.exam_named_month_note_guide
            daysEstimated -> if (notice) R.string.exam_estimated_note_notice else R.string.exam_estimated_note_guide
            else -> null
        }
    }

internal val ExamView.showsMoment: Boolean
    get() = stage == ExamView.Stage.FINAL_STRETCH || stage == ExamView.Stage.DAY_BEFORE || stage == ExamView.Stage.EXAM_DAY

/** The exam page's moment: after the exam the result form below asks "How did it go?" itself. */
internal val ExamView.moment: ExamMoment
    get() =
        ExamMoment(
            checklist =
                if (stage == ExamView.Stage.DAY_BEFORE || stage == ExamView.Stage.EXAM_DAY) {
                    checklist.map { item -> ExamMoment.Checklist.entries.first { it.value == item.value } }
                } else {
                    emptyList()
                },
            day = days.firstOrNull(),
            dayBefore = ExamMoment.DayBefore.entries.first { it.value == dayBefore.value },
            examName = examName,
            mocksTaken = mocks.size.toLong(),
            prepared = prepared,
            resultReported = true,
            sessionsDone = sessionsDone,
            stage = ExamMoment.Stage.entries.firstOrNull { it.value == stage.value } ?: ExamMoment.Stage.FINAL_STRETCH,
            timeZone = timeZone,
            tools = tools,
        )

internal val ExamView.takesResult: Boolean
    get() = stage == ExamView.Stage.EXAM_DAY || stage == ExamView.Stage.AFTER_EXAM

/** Main's notice-day card: a date the notice or the official calendar set, or no sitting in the learner's month. */
@Composable
internal fun NoticeDatesCard(
    exam: ExamView,
    viewModel: ExamViewModel,
) {
    val status by viewModel.date.collectAsStateWithLifecycle()
    val locale = currentLocale()
    val noticeDay = exam.noticeDay
    val noSitting = exam.noSitting
    val pending = status == SaveStatus.Pending

    OutlinedCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                painterResource(R.drawable.ic_calendar_month),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (noticeDay != null) {
                    Text(
                        noticeDayText(noticeDay.date.toJavaLocalDate(), noticeDay.estimated, exam.examDocument),
                        style = MaterialTheme.typography.titleSmall,
                    )
                    FilledTonalButton(onClick = { viewModel.useDate(noticeDay.date.toJavaLocalDate()) }, enabled = !pending) {
                        Text(stringResource(R.string.exam_use_this_date))
                    }
                } else if (noSitting != null) {
                    val month = formatDate(noSitting.month.toJavaLocalDate(), locale, DateStyle.Month)
                    Text(stringResource(R.string.exam_no_sitting_title, month), style = MaterialTheme.typography.titleSmall)
                    Text(
                        stringResource(
                            if (noSitting.closest.size ==
                                1
                            ) {
                                R.string.exam_no_sitting_detail_one
                            } else {
                                R.string.exam_no_sitting_detail_several
                            },
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        noSitting.closest.forEach { date ->
                            val day = date.toJavaLocalDate()
                            FilledTonalButton(onClick = { viewModel.useDate(day) }, enabled = !pending) {
                                Text(stringResource(R.string.exam_use_date, formatDate(day, locale, DateStyle.Long)))
                            }
                        }
                    }
                }
                if (status == SaveStatus.Failed) SuggestionSaveError()
            }
        }
    }
}

/** On the exam day and after it: the official result, on the exam's own scale, and whether they passed. */
@Composable
internal fun ExamResultSection(
    exam: ExamView,
    viewModel: ExamViewModel,
) {
    val status by viewModel.report.collectAsStateWithLifecycle()
    val locale = currentLocale()
    val scale = exam.resultScale
    val field = scoreField(scale)
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    var score by rememberSaveable { mutableStateOf("") }
    var maxScore by rememberSaveable { mutableStateOf("") }
    var passed by rememberSaveable { mutableStateOf<Boolean?>(null) }
    val parsedScore = parseLocalizedNumber(score, locale)
    val parsedMax = parseLocalizedNumber(maxScore, locale)
    val scoreError = scoreError(score, parsedScore, scale)
    val maxError = maxScore.isNotBlank() && (parsedMax == null || parsedMax <= 0 || parsedMax > MAX_SCORE)
    val canSave = (score.isNotBlank() || passed != null) && scoreError == null && !maxError && status != SaveStatus.Pending

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.exam_how_did_it_go),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                stringResource(R.string.exam_result_detail),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        val shown = if (status == SaveStatus.Saved) saved else exam.result.takeIf { status == SaveStatus.Idle }
        shown?.let { ResultSaved(it.score) }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
            OutlinedTextField(
                value = score,
                onValueChange = { score = it },
                modifier = Modifier.weight(1f),
                label = { Text(field) },
                supportingText = scoreError?.let { { Text(it) } },
                isError = scoreError != null,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
                singleLine = true,
            )
            if (scale == ExamResult.Scale.POINTS) {
                OutlinedTextField(
                    value = maxScore,
                    onValueChange = { maxScore = it },
                    modifier = Modifier.weight(1f),
                    label = { Text(stringResource(R.string.exam_out_of)) },
                    isError = maxError,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
                    singleLine = true,
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.exam_did_you_pass), style = MaterialTheme.typography.titleSmall)
            val choices = listOf(true to R.string.exam_passed_yes, false to R.string.exam_passed_no, null to R.string.exam_passed_unknown)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                choices.forEachIndexed { index, (value, label) ->
                    SegmentedButton(
                        selected = passed == value,
                        onClick = { passed = value },
                        shape = SegmentedButtonDefaults.itemShape(index, choices.size),
                    ) { Text(stringResource(label)) }
                }
            }
        }

        if (status == SaveStatus.Failed) SuggestionSaveError()

        Button(
            onClick = {
                viewModel.report(
                    ExamResultReport(
                        score = parsedScore,
                        scale = scale.takeIf { parsedScore != null },
                        maxScore = parsedMax.takeIf { scale == ExamResult.Scale.POINTS },
                        passed = passed,
                    ),
                )
            },
            enabled = canSave,
        ) { Text(stringResource(R.string.exam_save_result)) }
    }
}

@Composable
private fun ResultSaved(score: Double?) {
    val locale = currentLocale()
    Row(
        modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            painterResource(R.drawable.ic_check_circle),
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.tertiary,
        )
        Text(
            text =
                if (score == null) {
                    stringResource(R.string.exam_result_saved)
                } else {
                    stringResource(R.string.exam_result_saved_score, formatNumber(score, locale))
                },
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/** Main's `useScale`: the exam's own scale, else IRT or plain points. */
private val ExamView.resultScale: ExamResult.Scale
    get() =
        when (scoring.scale) {
            ExamViewScoring.Scale.AP -> ExamResult.Scale.AP
            ExamViewScoring.Scale.SAT -> ExamResult.Scale.SAT
            ExamViewScoring.Scale.TOEFL -> ExamResult.Scale.TOEFL
            null -> if (scoring.method == ExamViewScoring.Method.IRT) ExamResult.Scale.IRT else ExamResult.Scale.POINTS
        }

/** Core's `SCALE_RULES` for the exams with their own scale. */
private data class ScaleRule(
    val min: Double,
    val max: Double,
    val step: Double,
)

private val SCALE_RULES =
    mapOf(
        ExamResult.Scale.AP to ScaleRule(min = 1.0, max = 5.0, step = 1.0),
        ExamResult.Scale.SAT to ScaleRule(min = 400.0, max = 1600.0, step = 10.0),
        ExamResult.Scale.TOEFL to ScaleRule(min = 1.0, max = 6.0, step = 0.5),
    )

@Composable
private fun scoreField(scale: ExamResult.Scale): String =
    stringResource(
        when (scale) {
            ExamResult.Scale.AP -> R.string.exam_score_ap
            ExamResult.Scale.SAT -> R.string.exam_score_sat
            ExamResult.Scale.TOEFL -> R.string.exam_score_toefl
            ExamResult.Scale.IRT -> R.string.exam_score_irt
            ExamResult.Scale.PERCENT, ExamResult.Scale.POINTS -> R.string.exam_score
        },
    )

/** What the browser's number field refuses on main: no number, or one off the exam's scale. */
@Composable
private fun scoreError(
    text: String,
    score: Double?,
    scale: ExamResult.Scale,
): String? {
    if (text.isBlank()) return null
    val rule = SCALE_RULES[scale]
    val locale = currentLocale()
    return when {
        score == null || score < 0 || score > MAX_SCORE -> {
            stringResource(R.string.exam_score_invalid)
        }

        rule != null && !rule.allows(score) -> {
            stringResource(
                R.string.exam_score_off_scale,
                formatNumber(rule.min, locale),
                formatNumber(rule.max, locale),
                formatNumber(rule.step, locale),
            )
        }

        else -> {
            null
        }
    }
}

private fun ScaleRule.allows(score: Double): Boolean {
    val steps = score / step
    return score in min..max && abs(steps - steps.roundToLong()) < STEP_TOLERANCE
}

private const val MAX_SCORE = 10_000.0
private const val STEP_TOLERANCE = 1e-9
