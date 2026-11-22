package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.spaceAfterSentence
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/**
 * A goal's date as the plan answered it: a named month reads as the month, not its first day, and an
 * [estimated] one (an exam's likely day) is marked "~".
 */
data class GoalDate(
    val date: kotlinx.datetime.LocalDate,
    val namedMonth: Boolean,
    val estimated: Boolean = false,
)

/** Two goals typed together share the day: this one's time, the [others]' count and their time together. */
data class DaySplit(
    val mine: Int,
    val others: Int,
    val rest: Int,
)

/**
 * Main's `TimeAnswer`, shared by onboarding's time question and the Plan's time a day: the time we suggest, and that
 * time to use while a shorter one is picked, in one polite live region. While [updating], the last answer stays in
 * place, dimmed, and is read as busy.
 */
@Composable
fun TimeAnswer(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    offer: Int?,
    onRetry: () -> Unit,
    onUseOffer: (Int) -> Unit,
    modifier: Modifier = Modifier,
    finding: Boolean = false,
    split: DaySplit? = null,
    updating: Boolean = false,
    today: LocalDate = LocalDate.now(),
    aim: String? = null,
) {
    val failed = line == TimeLine.AskFailed || line == TimeLine.FindFailed
    val offered = offer?.takeUnless { failed }
    val busy = updating || line.isBusy || finding
    val busyWords = stringResource(R.string.plan_time_working)
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val style = MaterialTheme.typography.bodyMedium
    val lineWords = lineWords(date, exam, line, minutes, today, aim)
    val shared = split?.let { splitWords(it) }

    Column(
        modifier
            .alpha(if (updating) UPDATING_ALPHA else 1f)
            .semantics {
                liveRegion = LiveRegionMode.Polite
                if (busy) stateDescription = busyWords
            },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            lineWords + (shared?.let { spaceAfterSentence(lineWords) + it } ?: ""),
            color = muted,
            style = style,
        )
        when {
            failed -> {
                TextButton(onClick = onRetry, edge = ButtonEdge.Start) {
                    Text(stringResource(R.string.plan_try_again))
                }
            }

            offered != null -> {
                OutlinedButton(onClick = { onUseOffer(offered) }) {
                    Text(stringResource(R.string.plan_use_suggested_time, formatMinutes(offered, currentLocale())))
                }
            }
        }
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
): String {
    val formatted = formatDate(date.date.toJavaLocalDate(), currentLocale(), if (date.namedMonth) DateStyle.Month else DateStyle.Long, today)
    return if (date.estimated) stringResource(R.string.plan_date_estimate, formatted) else formatted
}

/** The time we suggest: by the date when it covers everything, or that the plan starts with what matters most. */
@Composable
private fun suggestWords(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine.Suggest,
    today: LocalDate,
): String {
    val time = formatMinutes(line.minutes, currentLocale())
    if (line.focus || date == null) {
        return stringResource(if (exam) R.string.plan_time_suggest_focus_exam else R.string.plan_time_suggest_focus_goal, time)
    }
    val month = date.namedMonth
    val words =
        when {
            exam && month -> R.string.plan_time_suggest_exam_month
            exam -> R.string.plan_time_suggest_exam
            month -> R.string.plan_time_suggest_goal_month
            else -> R.string.plan_time_suggest_goal
        }
    return stringResource(words, time, goalDateText(date, today))
}

@Composable
private fun lineWords(
    date: GoalDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    today: LocalDate,
    aim: String?,
): String {
    val locale = currentLocale()
    return when (line) {
        is TimeLine.Suggest -> {
            suggestWords(date, exam, line, today)
        }

        TimeLine.PastDate -> {
            date ?: return ""
            stringResource(
                if (date.namedMonth) R.string.plan_time_past_date_month else R.string.plan_time_past_date,
                goalDateText(date, today),
            )
        }

        is TimeLine.Finish -> {
            val month = formatDate(line.endDate.toJavaLocalDate(), locale, DateStyle.Month)
            // One quiet sentence, the month not singled out, as the Plan's own finish line.
            if (aim == null) {
                stringResource(R.string.plan_finish_around, month)
            } else {
                stringResource(R.string.onboarding_aim_finish, formatMinutes(minutes ?: 0, locale), aim, month)
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
            stringResource(R.string.plan_finish_working)
        }

        TimeLine.AskFailed -> {
            stringResource(R.string.plan_time_finish_failed)
        }
    }
}

private const val UPDATING_ALPHA = 0.5f
