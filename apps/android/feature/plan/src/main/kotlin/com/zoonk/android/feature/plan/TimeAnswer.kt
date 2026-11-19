package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.android.ui.format.spaceAfterSentence
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** A goal's date as the plan answered it: a named month reads as the month, not its first day. */
data class GoalDate(
    val date: kotlinx.datetime.LocalDate,
    val namedMonth: Boolean,
)

/** Two goals typed together share the day: this one's time, the [others]' count and their time together. */
data class DaySplit(
    val mine: Int,
    val others: Int,
    val rest: Int,
)

/**
 * Main's `TimeAnswer`, shared by onboarding's time question and the Plan's time a day: what
 * covering everything takes, what the time shown covers, and the other time to use, in one polite
 * live region. While [updating], the last answer stays in place, dimmed, and is read as busy.
 */
@Composable
fun TimeAnswer(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    note: FullTimeNote?,
    offer: TimeOffer?,
    onRetry: () -> Unit,
    onUseOffer: (Int) -> Unit,
    modifier: Modifier = Modifier,
    finding: Boolean = false,
    offerAsButton: Boolean = false,
    split: DaySplit? = null,
    updating: Boolean = false,
    today: LocalDate = LocalDate.now(),
    action: (@Composable () -> Unit)? = null,
    aim: String? = null,
) {
    val failed = line == TimeLine.AskFailed || line == TimeLine.FindFailed
    val offered = offer?.takeUnless { failed }
    val busy = updating || line.isBusy || finding
    val busyWords = stringResource(R.string.plan_working_out_coverage)
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val style = MaterialTheme.typography.bodyMedium
    val noteWords = noteWords(date, note, today)
    val lineWords = lineWords(date, exam, line, minutes, today, aim)
    val tooLong = stringResource(R.string.plan_time_too_long).takeIf { note == FullTimeNote.TooLong }
    val shared = split?.let { splitWords(it) }

    Column(modifier.heightIn(min = 48.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(
            Modifier
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
                    tooLong?.let { append(spaceAfterSentence(lineWords.text) + it) }
                    shared?.let { append(spaceAfterSentence(tooLong ?: lineWords.text) + it) }
                },
                color = muted,
                style = style,
            )
            when {
                failed -> {
                    TextButton(onClick = onRetry, edge = ButtonEdge.Start) {
                        Text(stringResource(R.string.plan_try_again))
                    }
                }

                offered != null && offerAsButton -> {
                    OutlinedButton(onClick = { onUseOffer(offered.minutes) }) { Text(offerLabel(offered)) }
                }

                offered != null -> {
                    TextButton(
                        onClick = { onUseOffer(offered.minutes) },
                        edge = ButtonEdge.Start,
                    ) {
                        Text(offerLabel(offered))
                    }
                }
            }
        }
        action?.invoke()
    }
}

@Composable
private fun noteWords(
    date: GoalDate?,
    note: FullTimeNote?,
    today: LocalDate,
): String? {
    if (date == null || note !is FullTimeNote.Takes) return null
    val takes = everythingTakesText(date, note.full, today)
    return if (note.moreDays) joinSentences(takes, stringResource(R.string.plan_time_more_days)) else takes
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
            stringResource(R.string.plan_time_takes_everything, formatMinutes(full.minutes, locale))
        }

        else -> {
            stringResource(
                R.string.plan_time_takes_most,
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

/** Main's share line under a time picker, its share standing out. */
@Composable
private fun shareWords(
    date: GoalDate,
    exam: Boolean,
    share: Double,
    today: LocalDate,
): AnnotatedString {
    val text = shareText(date, exam, share, today)
    val percent = formatPercent(share, currentLocale())
    val start = text.indexOf(percent)

    return buildAnnotatedString {
        append(text)
        if (start >= 0) addStyle(SpanStyle(fontWeight = FontWeight.SemiBold), start, start + percent.length)
    }
}

/** Main's `timeCovers`: the same fact as the share line, where no picker shows the time. */
@Composable
internal fun timeCoversText(
    exam: Boolean,
    minutes: Int,
    share: Double,
): String {
    val locale = currentLocale()
    return stringResource(
        if (exam) R.string.plan_time_covers_share_exam else R.string.plan_time_covers_share_goal,
        formatMinutes(minutes, locale),
        formatPercent(share, locale),
    )
}

@Composable
private fun lineWords(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    today: LocalDate,
    aim: String?,
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
                date ?: return AnnotatedString("")
                return shareWords(date, exam, line.coveredShare, today)
            }

            is TimeLine.Share -> {
                date ?: return AnnotatedString("")
                return shareWords(date, exam, line.share, today)
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
                // One quiet sentence, the month not singled out, as the Plan's own finish line.
                if (aim ==
                    null
                ) {
                    stringResource(R.string.plan_finish_around, month)
                } else {
                    stringResource(R.string.onboarding_aim_finish, time, aim, month)
                }
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

private const val UPDATING_ALPHA = 0.5f
