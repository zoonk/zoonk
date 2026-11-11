package com.zoonk.android.feature.session

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyDayProgress
import com.zoonk.api.models.StudyDayProgressCatchUp

/**
 * Today's session as one equal part per block, so the bar, the count and the percent agree. [held]
 * adds a part for time the day keeps for lessons not on the list yet, so the bar never looks full
 * while it waits for them.
 */
@Composable
fun DayProgress(
    fills: List<MeterPart.Fill>,
    held: Boolean,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val parts = fills.map { MeterPart(it) } + listOfNotNull(MeterPart(MeterPart.Fill.Track).takeIf { held })
    MeterParts(parts, modifier, contentDescription)
}

/** A day of one part draws no meter: the words already say "1 of 1". */
fun drawsDayProgress(
    parts: Int,
    held: Boolean,
): Boolean = parts + (if (held) 1 else 0) >= 2

/** Under a finished block's facts: the lessons earlier days left, as of this completion. */
@Composable
fun CatchUpLine(
    catchUp: StudyDayProgressCatchUp?,
    modifier: Modifier = Modifier,
) {
    val left = catchUp?.lessonsLeft?.toInt() ?: return
    val today = catchUp.doneToday.toInt()
    val locale = currentLocale()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val ink = MaterialTheme.colorScheme.onSurface
    val style = MaterialTheme.typography.bodyMedium

    when {
        today == 0 -> {
            Text(pluralStringResource(R.plurals.today_pace_lessons_to_catch_up, left, left), modifier, color = muted, style = style)
        }

        left == 0 -> {
            Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                DoneMark()
                Text(stringResource(R.string.session_no_catch_up_left), color = ink, style = style)
            }
        }

        else -> {
            val gained = pluralStringResource(R.plurals.session_caught_up_today, today, formatNumber(today.toDouble(), locale))
            val rest = pluralStringResource(R.plurals.session_catch_up_to_go, left, formatNumber(left.toDouble(), locale))
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = ink)) { append(gained) }
                    append(FACT_SEPARATOR)
                    append(rest)
                },
                modifier,
                color = muted,
                style = style,
            )
        }
    }
}

/**
 * A finished block's line about today's session: the count core says leads, its percent, and the
 * meter, where only the block just finished fills in while the moment celebrates.
 */
@Composable
fun SessionDayProgress(
    completion: StudyBlockCompletion,
    modifier: Modifier = Modifier,
) {
    val day = completion.dayProgress
    val completed = completion.sessionBar.completed.toInt()
    val total = completion.sessionBar.total.toInt()
    val open = day.lead == StudyDayProgress.Lead.OPEN
    if (total == 0 && !open) return

    val locale = currentLocale()
    val deferred = completion.deferredLessonsCount.toInt()
    val caption =
        when {
            day.lead == StudyDayProgress.Lead.LEFT -> {
                pluralStringResource(
                    R.plurals.session_day_done_caption,
                    completed,
                    formatNumber(completed.toDouble(), locale),
                    formatNumber(total.toDouble(), locale),
                )
            }

            open && day.lessonsComing -> {
                stringResource(R.string.session_day_more_coming)
            }

            else -> {
                null
            }
        }

    Column(modifier.fillMaxWidth().semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    leadLine(day.lead, completed, total),
                    Modifier.weight(1f).alignByBaseline(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
                day.percent?.let {
                    Text(
                        formatPercent(it / PERCENT, locale),
                        Modifier.alignByBaseline(),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.zoonkType.data,
                    )
                }
            }
            caption?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        }
        if (drawsDayProgress(total, held = open)) FinishedBlockMeter(completed, total, held = open)
        if (deferred > 0) {
            Text(
                pluralStringResource(
                    R.plurals.session_lessons_deferred,
                    deferred,
                    formatNumber(deferred.toDouble(), locale),
                    formatMinutes(completion.minutes.dailyGoal, locale),
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun leadLine(
    lead: StudyDayProgress.Lead,
    completed: Int,
    total: Int,
): AnnotatedString {
    val locale = currentLocale()
    val (number, sentence) =
        when (lead) {
            StudyDayProgress.Lead.LEFT -> {
                val left = total - completed
                left to pluralStringResource(R.plurals.session_day_left, left, MARK)
            }

            StudyDayProgress.Lead.OPEN -> {
                completed to pluralStringResource(R.plurals.session_day_open, completed, MARK)
            }

            StudyDayProgress.Lead.DONE, StudyDayProgress.Lead.COMPLETE -> {
                completed to pluralStringResource(R.plurals.session_day_done, completed, MARK, formatNumber(total.toDouble(), locale))
            }
        }
    val (before, after) = sentence.split(MARK, limit = 2).let { it.first() to it.getOrElse(1) { "" } }
    val emphasis = MaterialTheme.typography.bodyLarge.withTabularFigures()

    return buildAnnotatedString {
        append(before)
        withStyle(
            SpanStyle(
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold,
                fontFeatureSettings = emphasis.fontFeatureSettings,
            ),
        ) {
            append(formatNumber(number.toDouble(), locale))
        }
        append(after)
    }
}

@Composable
private fun FinishedBlockMeter(
    completed: Int,
    total: Int,
    held: Boolean,
) {
    val animates = completed > 0 && celebrates()
    val finished = remember { Animatable(if (animates) 0f else 1f) }
    LaunchedEffect(animates) {
        if (animates) finished.animateTo(1f, tween(ZoonkMotion.FILL_MILLIS, easing = ZoonkMotion.EaseOut))
    }
    val done = MaterialTheme.colorScheme.tertiary

    DayProgress(
        fills =
            List(total) { index ->
                when {
                    index == completed - 1 -> MeterPart.Fill.Solid(done, finished.value)
                    index < completed -> MeterPart.Fill.Solid(done)
                    else -> MeterPart.Fill.Track
                }
            },
        held = held,
    )
}

private const val MARK = "⁣"
private const val PERCENT = 100.0
