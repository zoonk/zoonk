package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.goalcontent.toTopicWords
import com.zoonk.android.ui.components.QuietDisclosure
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.PlanEffectTopics
import com.zoonk.api.models.PlanEffectWeeklyEvents
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** Whose date a change's lessons count against: an exam's, a goal's end date, or [Unknown] where a card can't tell. */
enum class GoalDateKind { Exam, Goal, Unknown }

/** What the screen's title already says, so the same count isn't said twice under it. */
enum class EffectSaid { LessonsAdded, }

internal val PlanPageState.dateKind: GoalDateKind get() = if (isExam) GoalDateKind.Exam else GoalDateKind.Goal

data class GoalDateMove(
    val after: LocalDate,
    val before: LocalDate?,
)

/**
 * Main's `PlanEffectDiff`: the one consequence a learner would notice about a plan change, and
 * every other change behind "See all changes". [repriced] says the numbers under it are today's,
 * to answer again; [summary] false leaves the consequence to the screen's own sentence.
 */
@Composable
fun PlanEffectDiff(
    effect: PlanEffect?,
    modifier: Modifier = Modifier,
    byDate: Boolean = true,
    dateKind: GoalDateKind = GoalDateKind.Unknown,
    goalDate: GoalDateMove? = null,
    repriced: Boolean = false,
    said: EffectSaid? = null,
    summary: Boolean = true,
) {
    val found = effect?.let { consequence(it, byDate, dateKind, goalDate) }
    val rows = effect?.let { changeRows(it, byDate, dateKind, goalDate) }.orEmpty()
    val repeatsTitle = said == EffectSaid.LessonsAdded && found?.key == ADDED && !namesAdded(effect)
    val stated = if (summary) found else null
    val saidWhole = stated != null && stated.whole && rows.singleOrNull()?.key == stated.key
    val shown = if (summary && !repeatsTitle) found else null
    val hasMore = rows.isNotEmpty() && !saidWhole

    if (shown == null && !hasMore && !repriced) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (repriced) {
            Text(
                text = stringResource(if (effect != null) R.string.plan_effect_numbers_different else R.string.plan_stays_as_it_is),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
        }
        shown?.let { Text(it.text, style = MaterialTheme.typography.bodyMedium) }
        if (hasMore) QuietDisclosure(stringResource(R.string.plan_effect_see_all)) { ChangeRows(rows) }
    }
}

private data class Consequence(
    val key: String,
    val text: String,
    /** False when its row says more than the sentence. */
    val whole: Boolean,
)

private data class ChangeRow(
    val key: String,
    val label: String,
    val after: String,
    val before: String? = null,
    val detail: String? = null,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChangeRows(rows: List<ChangeRow>) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val style = MaterialTheme.typography.bodySmall

    Column(Modifier.fillMaxWidth()) {
        rows.forEachIndexed { index, row ->
            if (index > 0) HorizontalDivider()
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).semantics(mergeDescendants = true) {},
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(row.label, modifier = Modifier.padding(end = 16.dp), style = style)
                    Text(
                        text =
                            buildAnnotatedString {
                                row.before?.let {
                                    withStyle(SpanStyle(color = muted)) { append(it) }
                                    withStyle(SpanStyle(color = muted)) { append(" → ") }
                                }
                                append(row.after)
                            },
                        modifier = Modifier.semantics { contentDescription = listOfNotNull(row.before, row.after).joinToString(", ") },
                        style = style.withTabularFigures(),
                    )
                }
                row.detail?.let { Text(it, style = style, color = muted) }
            }
        }
    }
}

private const val NOT_IN_PLAN = "notInPlan"
private const val ADDED = "added"
private const val NAMED_IN_SENTENCE = 3
private const val NAMED_IN_ROW = 8

private fun namesAdded(effect: PlanEffect?): Boolean =
    effect?.topicsAdded.orEmpty().isNotEmpty() || effect?.outcomesAdded.orEmpty().isNotEmpty()

private fun topicNames(areas: List<PlanEffectTopics>?): List<String> = areas.orEmpty().flatMap { area -> area.topics.map(::toTopicWords) }

/** Without a date the plan keeps every lesson, so only the net count changes. */
private fun countLessons(
    effect: PlanEffect,
    byDate: Boolean,
): Pair<Int, Int> {
    if (byDate) return effect.lessonsAdded.toInt() to effect.lessonsRemoved.toInt()
    val net = (effect.lessonsAdded - effect.lessonsRemoved).toInt()
    return net.coerceAtLeast(0) to (-net).coerceAtLeast(0)
}

/** The first [limit] names, then how many more: a card never lists every topic or lesson. */
@Composable
private fun names(
    kind: ListKind,
    limit: Int,
    names: List<String>,
): String {
    val named = names.take(limit)
    val more = names.size - named.size
    if (more == 0) return joinList(named)
    val first = named.joinToString(", ")
    return if (kind == ListKind.Topics) {
        pluralStringResource(R.plurals.plan_change_names_and_more_topics, more, first, more)
    } else {
        stringResource(R.string.plan_effect_names_and_more, first)
    }
}

/**
 * The one thing a learner would notice: what leaves the plan, else when it ends, else what joins it,
 * else one phase's end, the next mock or the weekly day.
 */
@Composable
private fun consequence(
    effect: PlanEffect,
    byDate: Boolean,
    dateKind: GoalDateKind,
    goalDate: GoalDateMove?,
): Consequence? {
    val lessons = lessonConsequence(effect, byDate, dateKind)
    if (lessons?.key == NOT_IN_PLAN) return lessons
    return endConsequence(effect, goalDate) ?: lessons ?: eventConsequence(effect)
}

@Composable
private fun lessonConsequence(
    effect: PlanEffect,
    byDate: Boolean,
    dateKind: GoalDateKind,
): Consequence? {
    val topicsOut = topicNames(effect.topicsLeftOut)
    val topicsIn = topicNames(effect.topicsAdded)
    val (added, removed) = countLessons(effect, byDate)

    if (topicsOut.isNotEmpty()) {
        val named = names(ListKind.Topics, NAMED_IN_SENTENCE, topicsOut)
        return Consequence(
            key = NOT_IN_PLAN,
            text = stringResource(if (topicsOut.size == 1) R.string.plan_effect_topic_leaves else R.string.plan_effect_topics_leave, named),
            whole = topicsOut.size <= NAMED_IN_SENTENCE && removed == 0,
        )
    }
    if (byDate && removed > 0) {
        val named = effect.lessonsLeftOut.orEmpty().size + effect.unwrittenLeftOut.orEmpty().size
        return Consequence(NOT_IN_PLAN, lessonCount(removed, dateKind, fewer = true), whole = named == 0)
    }
    if (topicsIn.isNotEmpty()) {
        val named = names(ListKind.Topics, NAMED_IN_SENTENCE, topicsIn)
        return Consequence(
            key = ADDED,
            text = stringResource(if (topicsIn.size == 1) R.string.plan_effect_topic_added else R.string.plan_effect_topics_added, named),
            whole = topicsIn.size <= NAMED_IN_SENTENCE && added == 0,
        )
    }
    return if (byDate && added > 0) Consequence(ADDED, lessonCount(added, dateKind, fewer = false), whole = true) else null
}

/** What a learner studies before their date, said for them and never for the lessons. */
@Composable
private fun lessonCount(
    count: Int,
    dateKind: GoalDateKind,
    fewer: Boolean,
): String {
    val plural =
        when (dateKind) {
            GoalDateKind.Exam -> if (fewer) R.plurals.plan_effect_fewer_before_exam else R.plurals.plan_effect_more_before_exam
            GoalDateKind.Goal -> if (fewer) R.plurals.plan_effect_fewer_before_end_date else R.plurals.plan_effect_more_before_end_date
            GoalDateKind.Unknown -> if (fewer) R.plurals.plan_effect_fewer else R.plurals.plan_effect_more
        }
    return pluralStringResource(plural, count, count)
}

/** A change that moves the goal's own date already says the date in its title. */
@Composable
private fun endConsequence(
    effect: PlanEffect,
    goalDate: GoalDateMove?,
): Consequence? {
    if (goalDate != null) return null
    val (before, after) = shownEndMove(effect) ?: return null
    return Consequence("end", stringResource(R.string.plan_effect_plan_ends, longDate(after), longDate(before)), whole = true)
}

@Composable
private fun eventConsequence(effect: PlanEffect): Consequence? {
    val phase = effect.phaseEnds?.singleOrNull()
    if (phase != null && phase.after != phase.before) {
        return Consequence(
            key = "phase:${phase.name}",
            text =
                stringResource(
                    R.string.plan_effect_phase_ends,
                    phase.name,
                    longDate(phase.after.toJavaLocalDate()),
                    longDate(phase.before.toJavaLocalDate()),
                ),
            whole = true,
        )
    }
    effect.nextMock?.let {
        val date = formatDate(it.after.toJavaLocalDate(), currentLocale(), DateStyle.WeekdayDay)
        return Consequence("nextMock", stringResource(R.string.plan_effect_next_mock, date), whole = true)
    }
    val weekly = effect.weeklyEvents ?: return null
    val day = weekdayName(weekly.after.toInt())
    val words =
        if (weekly.kind ==
            PlanEffectWeeklyEvents.Kind.MOCK
        ) {
            R.string.plan_effect_mocks_on
        } else {
            R.string.plan_effect_weekly_challenge_on
        }
    return Consequence("weekly", stringResource(words, day), whole = true)
}

/** Everything a change does, as plain rows: what "See all changes" opens. */
@Composable
private fun changeRows(
    effect: PlanEffect,
    byDate: Boolean,
    dateKind: GoalDateKind,
    goalDate: GoalDateMove?,
): List<ChangeRow> = lessonRows(effect, byDate) + dateRows(effect, dateKind, goalDate) + eventRows(effect)

@Composable
private fun lessonRows(
    effect: PlanEffect,
    byDate: Boolean,
): List<ChangeRow> {
    val (added, removed) = countLessons(effect, byDate)

    if (!byDate) {
        if (added == removed) return emptyList()
        val after =
            if (removed > 0) {
                pluralStringResource(R.plurals.plan_effect_row_fewer, removed, removed)
            } else {
                pluralStringResource(R.plurals.plan_effect_row_more, added, added)
            }
        return listOf(ChangeRow("lessons", stringResource(R.string.plan_effect_row_lessons), after))
    }

    val topicsOut = topicNames(effect.topicsLeftOut)
    val outNames =
        if (topicsOut.isNotEmpty()) {
            names(ListKind.Topics, NAMED_IN_ROW, topicsOut)
        } else {
            names(ListKind.Lessons, NAMED_IN_ROW, effect.lessonsLeftOut.orEmpty() + effect.unwrittenLeftOut.orEmpty().map { it.skill })
        }
    val inNames = names(ListKind.Topics, NAMED_IN_ROW, topicNames(effect.topicsAdded) + effect.outcomesAdded.orEmpty())

    return listOfNotNull(
        lessonRow(NOT_IN_PLAN, stringResource(R.string.plan_not_in_your_plan), removed, outNames),
        lessonRow(ADDED, stringResource(R.string.plan_effect_row_added), added, inNames),
    )
}

@Composable
private fun lessonRow(
    key: String,
    label: String,
    count: Int,
    names: String,
): ChangeRow? =
    when {
        count > 0 -> {
            ChangeRow(
                key,
                label,
                pluralStringResource(
                    R.plurals.plan_effect_row_lessons_count,
                    count,
                    count,
                ),
                detail =
                    names.ifEmpty {
                        null
                    },
            )
        }

        names.isNotEmpty() -> {
            ChangeRow(key, label, names)
        }

        else -> {
            null
        }
    }

@Composable
private fun dateRows(
    effect: PlanEffect,
    dateKind: GoalDateKind,
    goalDate: GoalDateMove?,
): List<ChangeRow> {
    val rows = mutableListOf<ChangeRow>()
    goalDate?.let {
        val label =
            stringResource(
                if (dateKind ==
                    GoalDateKind.Exam
                ) {
                    R.string.plan_effect_row_exam_date
                } else {
                    R.string.plan_effect_row_end_date
                },
            )
        rows += moved("goalDate", label, rowDate(it.after), it.before?.let { before -> rowDate(before) })
    }
    shownEndMove(effect)?.let { (before, after) ->
        rows +=
            moved("end", stringResource(R.string.plan_effect_row_plan_ends), rowDate(after), rowDate(before))
    }
    effect.phaseEnds.orEmpty().forEach {
        rows += moved("phase:${it.name}", stringResource(R.string.plan_effect_row_ends, it.name), rowDate(it.after), rowDate(it.before))
    }
    effect.areaStarts.orEmpty().forEach { area ->
        val after = area.after ?: return@forEach
        rows +=
            moved(
                "start:${area.area}",
                stringResource(R.string.plan_effect_row_starts, area.area),
                rowDate(after),
                area.before?.let { rowDate(it) },
            )
    }
    effect.areaEnds.orEmpty().forEach {
        rows += moved("end:${it.area}", stringResource(R.string.plan_effect_row_ends, it.area), rowDate(it.after), rowDate(it.before))
    }
    return rows
}

private fun moved(
    key: String,
    label: String,
    after: String,
    before: String?,
): List<ChangeRow> = if (after == before) emptyList() else listOf(ChangeRow(key, label, after, before))

@Composable
private fun eventRows(effect: PlanEffect): List<ChangeRow> {
    val locale = currentLocale()
    val rows = mutableListOf<ChangeRow>()
    effect.areaLessons.orEmpty().forEach {
        val after = it.after.toInt()
        rows +=
            ChangeRow(
                key = "lessons:${it.area}",
                label = it.area,
                after = pluralStringResource(R.plurals.plan_effect_row_lessons_to_go, after, after),
                before = formatNumber(it.before.toDouble(), locale),
            )
    }
    effect.nextMock?.let {
        rows +=
            ChangeRow("nextMock", stringResource(R.string.plan_effect_row_next_mock), rowDate(it.after), rowDate(it.before))
    }
    effect.weeklyEvents?.let {
        val label =
            stringResource(
                if (it.kind ==
                    PlanEffectWeeklyEvents.Kind.MOCK
                ) {
                    R.string.plan_effect_row_mock_exams
                } else {
                    R.string.plan_effect_row_weekly_challenge
                },
            )
        rows += ChangeRow("weekly", label, labelCase(weekdayName(it.after.toInt())), labelCase(weekdayName(it.before.toInt())))
    }
    effect.reviewFirst?.let {
        rows +=
            ChangeRow(
                key = "reviewFirst",
                label = stringResource(R.string.plan_effect_row_review_on, rowDate(it.date)),
                after = stringResource(R.string.plan_effect_row_starts_with, joinList(it.areas)),
            )
    }
    effect.addedTopicsStart?.let {
        rows +=
            ChangeRow(
                "addedStart",
                stringResource(R.string.plan_effect_row_new_lessons_start),
                rowDate(it),
            )
    }
    return rows
}

@Composable
private fun rowDate(date: kotlinx.datetime.LocalDate): String = rowDate(date.toJavaLocalDate())

/** Short in a row ("Nov 14"), with the year when it's in another year. */
@Composable
private fun rowDate(date: LocalDate): String = formatPlanDate(date, LocalDate.now(), currentLocale())

@Composable
private fun labelCase(text: String): String = text.replaceFirstChar { it.titlecase(currentLocale()) }
