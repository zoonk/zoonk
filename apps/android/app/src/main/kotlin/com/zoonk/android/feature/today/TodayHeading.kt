package com.zoonk.android.feature.today

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.FreshStart
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamMoment
import com.zoonk.api.models.PlanStatus
import com.zoonk.api.models.Today
import com.zoonk.api.models.TodayProgress
import kotlinx.datetime.toJavaLocalDate

/** The eyebrow's parts, separated by a dot; any can wrap to the next line. */
@Composable
internal fun TodayPageHeader(
    date: String?,
    state: String?,
    title: String,
    modifier: Modifier = Modifier,
    trailing: @Composable () -> Unit = {},
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val parts = listOfNotNull(date, state)
        if (parts.isNotEmpty()) Eyebrow(AnnotatedString(parts.joinToString(SEPARATOR)))
        TitleRow(title, trailing)
    }
}

@Composable
private fun Eyebrow(text: AnnotatedString) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

/** What sits beside the title moves under it when both don't fit, as at large font sizes. */
@Composable
private fun TitleRow(
    title: String,
    trailing: @Composable () -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        itemVerticalAlignment = Alignment.Bottom,
    ) {
        Text(
            text = title,
            modifier = Modifier.padding(end = 12.dp).semantics { heading() },
            style = MaterialTheme.typography.headlineMedium,
        )
        trailing()
    }
}

@Composable
internal fun TodayHeading(
    model: TodayDayModel,
    wide: Boolean,
    modifier: Modifier = Modifier,
    action: @Composable () -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(todayEyebrow(model))

        TitleRow(stringResource(R.string.today_title)) {
            if (wide) {
                action()
            } else {
                DayTime(model, MaterialTheme.typography.headlineMedium)
            }
        }

        if (model.state != DayState.Done && model.state != DayState.Rest) MockFundingLine(model)
    }
}

/** A mock the learner's plan doesn't include wears the Plus mark, so the line never reads as a mock they can take. */
@Composable
private fun MockFundingLine(model: TodayDayModel) {
    val funding = model.today.mockFunding ?: return
    val locale = currentLocale()
    val date = formatDate(funding.mockDate.toJavaLocalDate(), locale, DateStyle.Day, model.day.localDate.toJavaLocalDate())
    val text =
        if (model.day.freshStart == FreshStart.WelcomeBack) {
            stringResource(R.string.today_mock_funding_welcome_back, date)
        } else {
            stringResource(R.string.today_mock_funding, date)
        }

    FlowRow(
        modifier = Modifier.semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        if (!model.day.examAccess.includesMockExams) PlusMark()
    }
}

@Composable
private fun todayEyebrow(model: TodayDayModel): AnnotatedString {
    val today = model.today
    val locale = currentLocale()
    val date = model.day.localDate.toJavaLocalDate()
    val daysLeft = today.goal.daysLeft?.toInt()
    val exam = today.exam
    val status = today.progress?.status
    val parts = mutableListOf<AnnotatedString>()

    parts += AnnotatedString(formatDate(date, locale, DateStyle.WeekdayDayShort, date))

    if (daysLeft != null) {
        val text =
            when {
                today.goal.dateEstimated -> pluralStringResource(R.plurals.today_days_left_estimated, daysLeft, daysLeft)
                daysLeft == 0 -> stringResource(R.string.today_day_is_here)
                else -> pluralStringResource(R.plurals.today_days_left, daysLeft, daysLeft)
            }
        parts += AnnotatedString(text)
    }

    when (exam?.stage) {
        ExamMoment.Stage.DAY_BEFORE -> parts += AnnotatedString(stringResource(R.string.today_exam_tomorrow, exam.examName))
        ExamMoment.Stage.EXAM_DAY -> parts += AnnotatedString(stringResource(R.string.today_exam_today, exam.examName))
        else -> Unit
    }

    // Behind says so in a word before what to catch up; a return after a break says only "Behind".
    if (status != null && today.shortPlan == null) {
        val behind = status as? PlanStatus.PlanStatusOneOf2Value
        val welcomeBack = model.day.freshStart == FreshStart.WelcomeBack

        when {
            behind != null && welcomeBack -> {
                parts += AnnotatedString(stringResource(R.string.today_behind))
            }

            behind != null && behind.value.lessons != null -> {
                parts += AnnotatedString(stringResource(R.string.today_behind))
                parts += AnnotatedString(planStatusText(status))
            }

            status is PlanStatus.PlanStatusOneOf5Value -> {
                val error = MaterialTheme.colorScheme.error
                parts +=
                    buildAnnotatedString {
                        withStyle(
                            SpanStyle(color = error, fontWeight = FontWeight.Medium),
                        ) { append(planStatusText(status)) }
                    }
            }

            else -> {
                parts += AnnotatedString(planStatusText(status))
            }
        }
    }

    return buildAnnotatedString {
        parts.forEachIndexed { index, part ->
            if (index > 0) append(SEPARATOR)
            append(part)
        }
    }
}

/** The learner's pace against their plan, never whether the plan reaches the goal. */
@Composable
internal fun planStatusText(status: PlanStatus): String =
    when (status) {
        is PlanStatus.PlanStatusOneOfValue -> {
            stringResource(R.string.today_pace_on_track)
        }

        is PlanStatus.PlanStatusOneOf1Value -> {
            val days = status.value.days.toInt()
            if (days ==
                1
            ) {
                stringResource(R.string.today_pace_one_day_ahead)
            } else {
                pluralStringResource(R.plurals.today_pace_ahead, days, days)
            }
        }

        is PlanStatus.PlanStatusOneOf2Value -> {
            val lessons = status.value.lessons?.toInt()
            val days = status.value.days.toInt()
            if (lessons != null && lessons > 0) {
                pluralStringResource(R.plurals.today_pace_lessons_to_catch_up, lessons, lessons)
            } else if (days == 1) {
                stringResource(R.string.today_pace_one_day_behind)
            } else {
                pluralStringResource(R.plurals.today_pace_behind_days, days, days)
            }
        }

        is PlanStatus.PlanStatusOneOf3Value -> {
            val count = status.value.challenges.toInt()
            pluralStringResource(R.plurals.today_pace_challenges_left, count, count)
        }

        is PlanStatus.PlanStatusOneOf4Value -> {
            stringResource(R.string.today_pace_finished)
        }

        is PlanStatus.PlanStatusOneOf5Value -> {
            stringResource(R.string.today_pace_needs_adjusting)
        }

        is PlanStatus.PlanStatusOneOf6Value -> {
            stringResource(R.string.today_pace_past_date)
        }
    }

internal val TodayProgress.status: PlanStatus?
    get() =
        when (this) {
            is TodayProgress.TodayProgressOneOfValue -> value.status
            is TodayProgress.TodayProgressOneOf1Value -> value.status
        }

/** The lessons left once the goal's date passed; null before it. */
internal fun Today.pastDateLessons(): Long? = (progress?.status as? PlanStatus.PlanStatusOneOf6Value)?.value?.lessons

/** Minutes still ahead while the day is underway, the minutes actually studied once it's done. */
@Composable
internal fun DayTime(
    model: TodayDayModel,
    style: androidx.compose.ui.text.TextStyle,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val session = model.session
    val studied = model.day.studiedToday()
    val left = model.day.minutesLeft()

    val text =
        when {
            session.waiting -> {
                null
            }

            session.done || session.limitReached -> {
                if (studied >
                    0
                ) {
                    stringResource(R.string.today_time_studied, formatMinutes(studied.toInt(), locale))
                } else {
                    null
                }
            }

            left == 0L -> {
                null
            }

            else -> {
                stringResource(R.string.today_time_left, formatMinutes(left.toInt(), locale))
            }
        } ?: return

    Readout(text, modifier, style)
}

/** A status, so a day that changes while the learner is here (lessons that arrive) is announced. */
@Composable
internal fun TodayStatusLine(
    @DrawableRes icon: Int?,
    sentence: String,
    clause: String?,
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
    link: AnnotatedString? = null,
) {
    Column(modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }) {
        HorizontalDivider()
        Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            when {
                leading != null -> {
                    leading()
                }

                icon != null -> {
                    Icon(
                        painterResource(icon),
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            val muted = MaterialTheme.colorScheme.onSurfaceVariant
            Text(
                text =
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(sentence) }
                        if (clause != null) {
                            append(" ")
                            withStyle(SpanStyle(color = muted)) { append(clause) }
                        }
                        if (link != null) {
                            append(" ")
                            append(link)
                        }
                    },
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        HorizontalDivider()
    }
}

private const val SEPARATOR = " · "
