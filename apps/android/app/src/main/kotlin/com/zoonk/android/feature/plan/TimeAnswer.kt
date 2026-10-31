package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** A goal's date as the plan answered it: a named month reads as the month, not its first day. */
internal data class GoalDate(
    val date: kotlinx.datetime.LocalDate,
    val namedMonth: Boolean,
)

/** Two goals typed together share the day: this one's time, the [others]' count and their time together. */
internal data class DaySplit(
    val mine: Int,
    val others: Int,
    val rest: Int,
)

internal enum class NoteStatus { Finding, Failed }

/**
 * Main's `TimeAnswer`, shared by onboarding's time question and the Plan's time a day: what
 * covering everything takes, what the time shown covers, and the other time to use, in one polite
 * live region. While [updating], the last answer stays in place, dimmed, and is read as busy.
 */
@Composable
internal fun TimeAnswer(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    note: FullTimeNote?,
    offer: TimeOffer?,
    onRetry: () -> Unit,
    onUseOffer: (Int) -> Unit,
    modifier: Modifier = Modifier,
    noteStatus: NoteStatus? = null,
    offerAsButton: Boolean = false,
    split: DaySplit? = null,
    updating: Boolean = false,
    today: LocalDate = LocalDate.now(),
) {
    val failed = line == TimeLine.AskFailed || line == TimeLine.FindFailed || noteStatus == NoteStatus.Failed
    val offered = offer?.takeUnless { failed }
    val busy = updating || line.isBusy || noteStatus == NoteStatus.Finding
    val busyWords = stringResource(R.string.plan_working_out_coverage)
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val style = MaterialTheme.typography.bodyMedium
    val noteWords = noteWords(date, note, noteStatus, today)
    val lineWords = lineWords(date, exam, line, minutes, today)
    val tooLong = stringResource(R.string.plan_time_too_long).takeIf { note == FullTimeNote.TooLong }
    val shared = split?.let { splitWords(it) }

    Column(
        modifier
            .heightIn(min = 48.dp)
            .alpha(if (updating) UPDATING_ALPHA else 1f)
            .semantics {
                liveRegion = LiveRegionMode.Polite
                if (busy) stateDescription = busyWords
            },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        noteWords?.let { Text(it, color = muted, style = style) }
        Text(
            buildAnnotatedString {
                append(lineWords)
                tooLong?.let { append(" $it") }
                shared?.let { append(" $it") }
            },
            color = muted,
            style = style,
        )
        when {
            failed -> {
                TextButton(onClick = onRetry) { Text(stringResource(R.string.plan_try_again)) }
            }

            offered != null && offerAsButton -> {
                OutlinedButton(onClick = { onUseOffer(offered.minutes) }) { Text(offerLabel(offered)) }
            }

            offered != null -> {
                TextButton(onClick = { onUseOffer(offered.minutes) }) { Text(offerLabel(offered)) }
            }
        }
    }
}

@Composable
private fun noteWords(
    date: GoalDate?,
    note: FullTimeNote?,
    status: NoteStatus?,
    today: LocalDate,
): String? =
    when {
        date != null && note is FullTimeNote.Takes -> {
            val takes = everythingTakesText(date, note.full, today)
            if (note.moreDays) "$takes ${stringResource(R.string.plan_time_more_days)}" else takes
        }

        status == NoteStatus.Finding -> {
            stringResource(R.string.plan_time_working)
        }

        status == NoteStatus.Failed -> {
            stringResource(R.string.plan_time_find_failed)
        }

        else -> {
            null
        }
    }

@Composable
private fun offerLabel(offer: TimeOffer): String {
    val time = formatMinutes(offer.minutes, currentLocale())
    return when (offer.kind) {
        OfferKind.Everything -> stringResource(R.string.plan_time_use_to_cover_everything, time)
        OfferKind.Focus -> stringResource(R.string.plan_time_use_suggested, time)
        OfferKind.Full -> stringResource(R.string.plan_use_time, time)
    }
}

@Composable
private fun splitWords(split: DaySplit): String {
    val locale = currentLocale()
    val words = if (split.others == 1) R.string.plan_time_split_one else R.string.plan_time_split_many
    return stringResource(words, formatMinutes(split.mine, locale), formatMinutes(split.rest, locale))
}

@Composable
internal fun goalDateText(
    date: GoalDate,
    today: LocalDate,
): String = formatDate(date.date.toJavaLocalDate(), currentLocale(), if (date.namedMonth) DateStyle.Month else DateStyle.Long, today)

/** What the longest useful time takes by the date, or that not even a whole day covers everything. */
@Composable
internal fun everythingTakesText(
    date: GoalDate,
    full: FullTime?,
    today: LocalDate,
): String {
    val shown = goalDateText(date, today)
    val month = date.namedMonth
    val locale = currentLocale()
    return when {
        full == null -> {
            stringResource(if (month) R.string.plan_time_none_month else R.string.plan_time_none, shown)
        }

        full.everything -> {
            stringResource(
                if (month) R.string.plan_time_takes_everything_month else R.string.plan_time_takes_everything,
                shown,
                formatMinutes(full.minutes, locale),
            )
        }

        else -> {
            stringResource(
                if (month) R.string.plan_time_takes_most_month else R.string.plan_time_takes_most,
                shown,
                formatPercent(full.coveredShare, locale),
                formatMinutes(full.minutes, locale),
            )
        }
    }
}

@Composable
internal fun shareText(
    date: GoalDate,
    exam: Boolean,
    share: Double,
    today: LocalDate,
): String =
    stringResource(
        when {
            exam && date.namedMonth -> R.string.plan_time_share_exam_month
            exam -> R.string.plan_time_share_exam
            date.namedMonth -> R.string.plan_time_share_goal_month
            else -> R.string.plan_time_share_goal
        },
        formatPercent(share, currentLocale()),
        goalDateText(date, today),
    )

/** What a plan at a focus suggestion does first, and how much of everything it studies in depth. */
@Composable
internal fun focusText(
    coveredShare: Double,
    everyTopic: Boolean,
    exam: Boolean,
): String =
    stringResource(
        when {
            exam && everyTopic -> R.string.plan_time_focus_exam_every_topic
            exam -> R.string.plan_time_focus_exam_most_asked
            everyTopic -> R.string.plan_time_focus_goal_every_part
            else -> R.string.plan_time_focus_goal_most_important
        },
        formatPercent(coveredShare, currentLocale()),
    )

@Composable
private fun lineWords(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    today: LocalDate,
): AnnotatedString {
    val locale = currentLocale()
    val time = formatMinutes(minutes ?: 0, locale)
    val text =
        when (line) {
            is TimeLine.Everything -> {
                date ?: return AnnotatedString("")
                val month = date.namedMonth
                stringResource(
                    when {
                        line.suggested && exam && month -> R.string.plan_time_takes_exam_all_month
                        line.suggested && exam -> R.string.plan_time_takes_exam_all
                        line.suggested && month -> R.string.plan_time_takes_goal_all_month
                        line.suggested -> R.string.plan_time_takes_goal_all
                        exam && month -> R.string.plan_time_covers_exam_all_month
                        exam -> R.string.plan_time_covers_exam_all
                        month -> R.string.plan_time_covers_goal_all_month
                        else -> R.string.plan_time_covers_goal_all
                    },
                    goalDateText(date, today),
                )
            }

            is TimeLine.Focus -> {
                stringResource(R.string.plan_time_suggest, time) + " " + focusText(line.coveredShare, line.everyTopic, exam)
            }

            is TimeLine.Share -> {
                date ?: return AnnotatedString("")
                shareText(date, exam, line.share, today)
            }

            TimeLine.PastDate -> {
                date ?: return AnnotatedString("")
                stringResource(
                    if (date.namedMonth) R.string.plan_time_past_date_month else R.string.plan_time_past_date,
                    goalDateText(date, today),
                )
            }

            is TimeLine.Finish -> {
                val month = formatDate(line.endDate.toJavaLocalDate(), locale, DateStyle.Month)
                return stringResource(R.string.plan_finish_around, month)
                    .emphasizing(month, SpanStyle(fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface))
            }

            TimeLine.NoFinish -> {
                stringResource(R.string.plan_time_finish_unknown)
            }

            TimeLine.NoDays -> {
                stringResource(R.string.plan_time_no_days)
            }

            TimeLine.Working -> {
                stringResource(R.string.plan_time_working)
            }

            TimeLine.FindFailed -> {
                stringResource(R.string.plan_time_find_failed)
            }

            TimeLine.Asking -> {
                if (date == null) stringResource(R.string.plan_finish_working) else stringResource(R.string.plan_time_asking, time)
            }

            TimeLine.AskFailed -> {
                if (date == null) stringResource(R.string.plan_time_finish_failed) else stringResource(R.string.plan_time_ask_failed, time)
            }
        }
    return AnnotatedString(text)
}

private fun String.emphasizing(
    part: String,
    style: SpanStyle,
): AnnotatedString {
    val start = indexOf(part)
    return buildAnnotatedString {
        if (start < 0) {
            append(this@emphasizing)
        } else {
            append(substring(0, start))
            withStyle(style) { append(part) }
            append(substring(start + part.length))
        }
    }
}

private const val UPDATING_ALPHA = 0.5f
