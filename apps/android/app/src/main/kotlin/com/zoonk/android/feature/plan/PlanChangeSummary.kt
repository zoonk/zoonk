package com.zoonk.android.feature.plan

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.DiffKind
import com.zoonk.android.ui.components.DiffLine
import com.zoonk.android.ui.components.DiffLines
import com.zoonk.android.ui.components.DiffTone
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.PlanEffectWeeklyEvents
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/**
 * What an applied change did, as main's `PlanChangeSummary`: its sentence, what it moved, whether
 * today's session took it, and each phase's new end. An undone change says so instead. [targetDate]
 * and [fullCourse] are the plan's after the change.
 */
@Composable
fun PlanChangeSummary(
    change: PlanChange,
    targetDate: LocalDate?,
    fullCourse: Boolean,
    @DrawableRes icon: Int,
    modifier: Modifier = Modifier,
) {
    val undone = change.status == PlanChange.Status.UNDONE

    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            modifier = Modifier.padding(top = 2.dp).size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = if (undone) stringResource(R.string.plan_change_undone) else planChangeSentence(change),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            if (!undone) {
                planChangeAppliedEffect(change, targetDate, fullCourse)?.let { SupportingLine(it) }
                SupportingLine(planChangeAppliedLine(change.todaySession))
                PhaseEndMoves(change.effect)
            }
        }
    }
}

@Composable
private fun SupportingLine(text: String) {
    Text(text = text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
fun PhaseEndMoves(
    effect: PlanEffect?,
    modifier: Modifier = Modifier,
) {
    val rows = phaseEndRows(effect)
    if (rows.isEmpty()) return
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        rows.forEach { SupportingLine(it) }
    }
}

data class GoalDateMove(
    val after: LocalDate,
    val before: LocalDate?,
)

/**
 * Main's `PlanEffectDiff`: what a change moves, now and after, as lines. Against a date, lessons
 * left out are bad news; without one ([byDate] false) only the net count changes, fewer lessons is
 * good news and more a plain change.
 */
@Composable
fun PlanEffectDiff(
    effect: PlanEffect?,
    modifier: Modifier = Modifier,
    byDate: Boolean = true,
    goalDate: GoalDateMove? = null,
) {
    val lines = diffLines(effect, goalDate, byDate)
    if (lines.isEmpty()) return

    DiffLines(
        lines = lines,
        added = stringResource(R.string.plan_change_after),
        removed = stringResource(R.string.plan_change_now),
        modifier = modifier,
    )
}

@Composable
private fun diffLines(
    effect: PlanEffect?,
    goalDate: GoalDateMove?,
    byDate: Boolean,
): List<DiffLine> {
    effect ?: return emptyList()
    val lines = mutableListOf<DiffLine>()
    lines += lessonLines(effect, byDate)

    goalDate?.takeIf { it.after != it.before }?.let { move ->
        move.before?.let {
            lines +=
                DiffLine(DiffKind.Removed, stringResource(R.string.plan_change_goal_date_line, diffDate(it)), DiffTone.Neutral)
        }
        lines += DiffLine(DiffKind.Added, stringResource(R.string.plan_change_goal_date_line, diffDate(move.after)), DiffTone.Neutral)
    }
    shownEndMove(effect)?.let { (before, after) ->
        lines +=
            moved(
                stringResource(R.string.plan_change_plan_ends, diffDate(before)),
                stringResource(R.string.plan_change_plan_ends, diffDate(after)),
            )
    }
    effect.phaseEnds.orEmpty().forEach {
        lines +=
            moved(
                stringResource(R.string.plan_change_until, it.name, diffDate(it.before.toJavaLocalDate(), DateStyle.Day)),
                stringResource(R.string.plan_change_until, it.name, diffDate(it.after.toJavaLocalDate(), DateStyle.Day)),
            )
    }
    effect.areaEnds.orEmpty().forEach {
        lines +=
            moved(
                stringResource(R.string.plan_change_until, it.area, diffDate(it.before.toJavaLocalDate(), DateStyle.Day)),
                stringResource(R.string.plan_change_until, it.area, diffDate(it.after.toJavaLocalDate(), DateStyle.Day)),
            )
    }
    effect.areaLessons.orEmpty().forEach {
        lines +=
            moved(
                pluralStringResource(R.plurals.plan_change_area_to_go, it.before.toInt(), it.area, it.before.toInt()),
                pluralStringResource(R.plurals.plan_change_area_to_go, it.after.toInt(), it.area, it.after.toInt()),
            )
    }
    effect.nextMock?.let {
        lines +=
            moved(
                stringResource(R.string.plan_change_next_mock, diffDate(it.before.toJavaLocalDate(), DateStyle.Day)),
                stringResource(R.string.plan_change_next_mock, diffDate(it.after.toJavaLocalDate(), DateStyle.Day)),
            )
    }
    effect.weeklyEvents?.let {
        val words =
            if (it.kind ==
                PlanEffectWeeklyEvents.Kind.MOCK
            ) {
                R.string.plan_change_mocks_on
            } else {
                R.string.plan_change_weekly_challenges_on
            }
        lines += moved(stringResource(words, weekdayName(it.before.toInt())), stringResource(words, weekdayName(it.after.toInt())))
    }
    return lines
}

private fun moved(
    before: String,
    after: String,
): List<DiffLine> {
    if (before == after) return emptyList()
    return listOf(DiffLine(DiffKind.Removed, before, DiffTone.Neutral), DiffLine(DiffKind.Added, after, DiffTone.Neutral))
}

/** Without a date only the net count changes, never "8 fewer" beside "1 more". */
@Composable
private fun lessonLines(
    effect: PlanEffect,
    byDate: Boolean,
): List<DiffLine> {
    val net = (effect.lessonsAdded - effect.lessonsRemoved).toInt()
    val added = if (byDate) effect.lessonsAdded.toInt() else net.coerceAtLeast(0)
    val removed = if (byDate) effect.lessonsRemoved.toInt() else (-net).coerceAtLeast(0)
    val about = effect.lessonsAddedEstimated == true
    return listOfNotNull(
        if (removed > 0) {
            DiffLine(
                kind = DiffKind.Removed,
                text =
                    if (byDate) {
                        pluralStringResource(R.plurals.plan_change_leaves_out, removed, removed)
                    } else {
                        pluralStringResource(R.plurals.plan_change_fewer_lessons, removed, removed)
                    },
                tone = if (byDate) DiffTone.Bad else DiffTone.Good,
                labeled = false,
            )
        } else {
            null
        },
        if (added > 0) {
            DiffLine(
                kind = DiffKind.Added,
                text =
                    when {
                        byDate && about -> pluralStringResource(R.plurals.plan_change_adds_about, added, added)
                        byDate -> pluralStringResource(R.plurals.plan_change_adds, added, added)
                        about -> pluralStringResource(R.plurals.plan_change_about_more_lessons, added, added)
                        else -> pluralStringResource(R.plurals.plan_change_more_lessons, added, added)
                    },
                tone = if (byDate) DiffTone.Good else DiffTone.Neutral,
                labeled = false,
            )
        } else {
            null
        },
    )
}

/** A date in a diff line keeps its words together. */
@Composable
private fun diffDate(
    date: LocalDate,
    style: DateStyle = DateStyle.Long,
): String = formatDate(date, currentLocale(), style).replace(' ', NO_BREAK_SPACE)

private const val NO_BREAK_SPACE = '\u00A0'
