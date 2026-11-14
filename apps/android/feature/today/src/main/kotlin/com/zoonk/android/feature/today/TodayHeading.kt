package com.zoonk.android.feature.today

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
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
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.feature.plan.shortDayRange
import com.zoonk.android.feature.session.FreshStart
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.dottedUnderline
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.spaceAfterSentence
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamMoment
import com.zoonk.api.models.PlanStatus
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.Today
import com.zoonk.api.models.TodayProgress
import kotlinx.datetime.toJavaLocalDate

@Composable
internal fun TodayPageHeader(
    title: String,
    modifier: Modifier = Modifier,
) {
    PageTitleRow(title, modifier)
}

/** "Today" with the day's time, and under it one line at most: only what changes today, so a normal day has none. */
@Composable
internal fun TodayHeading(
    model: TodayDayModel,
    onAdjustPlan: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PageTitleRow(stringResource(R.string.today_title)) { DayTime(model, MaterialTheme.typography.headlineSmall) }
        TodayLine(model, onAdjustPlan)
    }
}

/** A return after days away leads with its welcome, so the plan's state waits for the learner to start. */
@Composable
private fun TodayLine(
    model: TodayDayModel,
    onAdjustPlan: () -> Unit,
) {
    val today = model.today
    val exam = today.exam
    val daysLeft = today.goal.daysLeft?.toInt()
    val short = today.shortPlan

    when {
        model.welcomesBack -> {
            Supporting(stringResource(R.string.today_welcome_back_line))
        }

        short != null -> {
            Supporting(shortDayRange(short.days.toInt(), short.day.toInt()))
        }

        today.progress?.status is PlanStatus.PlanStatusOneOf5Value && !model.welcomesBack -> {
            NotEnoughTime(onAdjustPlan)
        }

        exam?.stage == ExamMoment.Stage.FINAL_STRETCH && daysLeft != null -> {
            Supporting(pluralStringResource(R.plurals.today_exam_in_days, daysLeft, exam.examName, daysLeft))
        }
    }
}

@Composable
private fun Supporting(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun NotEnoughTime(onAdjustPlan: () -> Unit) {
    val sentence = stringResource(R.string.today_not_enough_time)
    val link = stringResource(R.string.today_adjust_your_plan)
    val ink = MaterialTheme.colorScheme.onSurface
    val text =
        buildAnnotatedString {
            append(sentence)
            append(spaceAfterSentence(sentence))
            withLink(
                LinkAnnotation.Clickable(
                    tag = "adjust-plan",
                    styles = TextLinkStyles(SpanStyle(color = ink, fontWeight = FontWeight.Medium)),
                ) {
                    onAdjustPlan()
                },
            ) {
                append(link)
                appendInlineContent(CHEVRON)
            }
        }
    val chevron =
        mapOf(
            CHEVRON to
                InlineTextContent(Placeholder(1.em, 1.em, PlaceholderVerticalAlign.TextCenter)) {
                    Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, tint = ink)
                },
        )

    Text(text, inlineContent = chevron, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

private const val CHEVRON = "chevron"

/** The day welcomes the learner back until they start, except on a day they're ahead or resting. */
internal val TodayDayModel.welcomesBack: Boolean
    get() =
        day.freshStart == FreshStart.WelcomeBack &&
            day.showsFreshStart(today.studiedToday) &&
            state != StudySession.State.AHEAD &&
            state != StudySession.State.REST

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
    val studied = model.day.studiedToday()
    val left = model.day.minutes.left

    val text =
        when {
            model.state == StudySession.State.REST -> {
                null
            }

            model.state == StudySession.State.DONE -> {
                if (studied >
                    0
                ) {
                    stringResource(R.string.today_time_studied, formatMinutes(studied.toInt(), locale))
                } else {
                    null
                }
            }

            left == 0.0 -> {
                null
            }

            else -> {
                stringResource(R.string.today_time_left, formatMinutes(left, locale))
            }
        } ?: return

    val funding = model.today.mockFunding
    if (funding == null || model.state == StudySession.State.DONE) {
        Readout(text, modifier, style)
        return
    }

    // A day that keeps time for a mock exam is shorter than the learner's time a day, so its time opens why.
    val date = formatDate(funding.mockDate.toJavaLocalDate(), locale, DateStyle.Day, model.day.localDate.toJavaLocalDate())
    TodayPopover(
        title = stringResource(R.string.today_shorter_day),
        facts = null,
        note = stringResource(R.string.today_shorter_day_note, date),
        modifier = modifier,
    ) { open ->
        Readout(text, open.dottedUnderline(MaterialTheme.colorScheme.onSurfaceVariant), style)
    }
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
                            append(spaceAfterSentence(sentence))
                            withStyle(SpanStyle(color = muted)) { append(clause) }
                        }
                        if (link != null) {
                            append(spaceAfterSentence(clause ?: sentence))
                            append(link)
                        }
                    },
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        HorizontalDivider()
    }
}
