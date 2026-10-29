package com.zoonk.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltDot
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.CurrentUserProgressResponseLevel
import kotlinx.datetime.toJavaLocalDate
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.ceil

private fun percent(
    value: Double,
    locale: Locale,
) = formatPercent(value / PERCENT, locale)

private fun whole(
    value: Long,
    locale: Locale,
) = formatNumber(value.toDouble(), locale, maximumFractionDigits = 0)

@Composable
private fun icon(id: Int): @Composable (Modifier) -> Unit =
    { modifier -> Icon(painterResource(id), contentDescription = null, modifier = modifier) }

@Composable
private fun tonedIcon(
    id: Int,
    tone: StatTone,
): @Composable (Modifier) -> Unit {
    val tint = tone.color
    return { modifier -> Icon(painterResource(id), contentDescription = null, modifier = modifier, tint = tint) }
}

private fun beltOf(color: String) = Belt.entries.first { it.name.equals(color, ignoreCase = true) }

// Overview

@Composable
internal fun StatsOverview(context: StatsContext) {
    val locale = currentLocale()
    val progress =
        context.stats.progress
            .collectShown()
            .value.value ?: return StatsEmpty(context)
    val energy by context.stats.energy.collectShown()
    val activity by context.stats.activity.collectShown()
    val patterns by context.stats.patterns.collectShown()
    val level = progress.level

    if (!(progress.activity.learningDays > 0 || level != null)) return StatsEmpty(context)

    val tiles =
        listOfNotNull<@Composable (Modifier) -> Unit>(
            level?.let { { modifier -> LevelTile(it, modifier) { context.open(StatsPage.Level) } } },
            progress.energy?.let { now ->
                { modifier ->
                    StatTile(
                        label = stringResource(R.string.stats_energy),
                        value = percent(now.currentEnergy, locale),
                        detail =
                            energy.value?.insights?.let {
                                stringResource(
                                    R.string.stats_energy_average,
                                    percent(it.averageEnergy, locale),
                                )
                            },
                        tone = StatTone.Energy,
                        icon = tonedIcon(R.drawable.ic_bolt, StatTone.Energy),
                        onClick = { context.open(StatsPage.Energy) },
                        modifier = modifier,
                    )
                }
            },
            { modifier ->
                val lessons = progress.activity.totalLessonCompletions.toInt()
                StatTile(
                    label = stringResource(R.string.stats_study_days),
                    value = whole(progress.activity.learningDays, locale),
                    detail =
                        pluralStringResource(
                            R.plurals.stats_lessons_time,
                            lessons,
                            lessons,
                            formatDuration(progress.activity.totalLearningSeconds, locale),
                        ),
                    tone = StatTone.Success,
                    icon = tonedIcon(R.drawable.ic_bar_chart, StatTone.Success),
                    onClick = { context.open(StatsPage.Activity) },
                    modifier = modifier,
                )
            },
            { modifier ->
                val score = progress.score
                StatTile(
                    label = stringResource(R.string.stats_score),
                    value = score?.let { percent(it.score, locale) } ?: stringResource(R.string.stats_not_yet),
                    detail =
                        score?.let {
                            stringResource(
                                R.string.stats_right_count,
                                whole(it.correctAnswers, locale),
                                whole(it.totalAnswers, locale),
                            )
                        }
                            ?: stringResource(R.string.stats_right_last_90),
                    tone = StatTone.Success,
                    icon = tonedIcon(R.drawable.ic_target, StatTone.Success),
                    onClick = { context.open(StatsPage.Score) },
                    modifier = modifier,
                )
            },
        )

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(columns = if (context.wide) 4 else 2, tiles = tiles)
        activity.value?.let { ActivityCalendar(it) }

        // Main shows the trend and the patterns from `md`; narrower, a row leads to the patterns.
        if (context.wide) {
            Row(horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                ScoreTrend(context, Modifier.weight(1.25f))
                PatternsOverview(context, patterns.value, Modifier.weight(1f))
            }
        } else {
            val summary = patterns.value?.let { patternsSummary(it) }
            val names = listOfNotNull(summary?.let { bestDayName(it.days) }, summary?.let { bestTimeName(it.times) })
            OutlinedCard(onClick = { context.open(StatsPage.Patterns) }) {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.stats_patterns)) },
                    trailingContent = { Text(names.joinToString(" · ").ifEmpty { stringResource(R.string.stats_not_yet) }) },
                )
            }
        }
    }
}

@Composable
private fun LevelTile(
    level: CurrentUserProgressResponseLevel,
    modifier: Modifier,
    onClick: (() -> Unit)? = null,
) {
    val belt = beltOf(level.belt.value)

    StatTile(
        label = stringResource(R.string.stats_level),
        value = whole(level.level, currentLocale()),
        detail = stringResource(belt.label),
        icon = { BeltDot(belt, it) },
        onClick = onClick,
        modifier = modifier,
    )
}

@Composable
private fun ScoreTrend(
    context: StatsContext,
    modifier: Modifier = Modifier,
) {
    val score =
        context.stats.score
            .collectShown()
            .value.value

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (score == null) {
            SectionHeader(stringResource(R.string.stats_score_90))
            StatsLine(stringResource(R.string.stats_score_after_answers))
        } else {
            ScoreChart(score.dataPoints.map { it.date.toJavaLocalDate() to it.score })
        }
    }
}

@Composable
private fun PatternsOverview(
    context: StatsContext,
    patterns: com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns?,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val summary = patterns?.let { patternsSummary(it) }
    val counted =
        patterns
            ?.weekdays
            .orEmpty()
            .filter { it.totalAnswers >= MIN_PATTERN_ANSWERS }
            .map { it.score }
    val spread =
        if (counted.size >=
            2
        ) {
            stringResource(R.string.stats_range, percent(counted.min(), locale), percent(counted.max(), locale))
        } else {
            null
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SectionHeader(stringResource(R.string.stats_patterns_90), Modifier.weight(1f))
            TextButton(onClick = { context.open(StatsPage.Patterns) }) { Text(stringResource(R.string.stats_see_all)) }
        }

        OutlinedCard {
            PatternRow(stringResource(R.string.stats_best_day), summary?.let { bestDayName(it.days) }, summary?.days?.bestScore(locale))
            PatternRow(stringResource(R.string.stats_best_time), summary?.let { bestTimeName(it.times) }, summary?.times?.bestScore(locale))
            spread?.let { PatternRow(stringResource(R.string.stats_week_spread), it, null) }
        }

        summary?.let { PatternsNote(it) }
    }
}

@Composable
private fun PatternRow(
    label: String,
    value: String?,
    score: String?,
) {
    ListItem(
        headlineContent = { Text(label) },
        trailingContent = { Text(listOfNotNull(value ?: stringResource(R.string.stats_not_yet), score).joinToString("  ")) },
    )
}

// Level

@Composable
internal fun LevelPage(context: StatsContext) {
    val locale = currentLocale()
    val level =
        context.stats.progress
            .collectShown()
            .value.value
            ?.level ?: return StatsEmpty(context)
    val belt = beltOf(level.belt.value)
    val nextBelt = level.nextBelt?.let { beltOf(it.belt.value) }

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier -> LevelTile(level, modifier) },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_brain_power),
                            value = whole(level.totalBrainPower, locale),
                            detail = stringResource(R.string.stats_never_goes_down),
                            tone = StatTone.Brain,
                            icon = tonedIcon(R.drawable.ic_psychology, StatTone.Brain),
                            modifier = modifier,
                        )
                    },
                    { modifier -> NextLevelTile(level, nextBelt, modifier) },
                ),
        )

        BeltProgression(level, belt, nextBelt)
        StatsLine(stringResource(R.string.stats_level_line, whole(BRAIN_POWER_PER_LESSON, locale)))
    }
}

/** After a belt's tenth level the next is the next belt's first, so the tile names that belt. */
@Composable
private fun NextLevelTile(
    level: CurrentUserProgressResponseLevel,
    nextBelt: Belt?,
    modifier: Modifier,
) {
    val locale = currentLocale()

    if (level.isMaxLevel) {
        StatTile(
            label = stringResource(R.string.stats_next_level),
            value = DASH,
            detail = stringResource(R.string.stats_max_level),
            icon = icon(R.drawable.ic_keyboard_double_arrow_up),
            modifier = modifier,
        )
        return
    }

    val label =
        if (nextBelt != null && level.level == LEVELS_PER_BELT) {
            stringResource(R.string.stats_to_belt, stringResource(nextBelt.label))
        } else {
            stringResource(R.string.stats_to_level, whole(level.level + 1, locale))
        }

    StatTile(
        label = label,
        value = whole(level.bpToNextLevel, locale) + " " + stringResource(R.string.stats_brain_power),
        icon = icon(R.drawable.ic_keyboard_double_arrow_up),
        modifier = modifier,
        footer = { Meter(level.progressInLevel.toFloat() / level.bpPerLevel.coerceAtLeast(1), color = MaterialTheme.zoonk.brain) },
    )
}

/** Main's belt progression: the belt's ten levels, how far into this one, the next belt and every belt in order. */
@Composable
private fun BeltProgression(
    level: CurrentUserProgressResponseLevel,
    belt: Belt,
    nextBelt: Belt?,
) {
    val locale = currentLocale()
    val share = if (level.isMaxLevel) 1f else level.progressInLevel.toFloat() / level.bpPerLevel.coerceAtLeast(1)
    val brain = MaterialTheme.zoonk.brain
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val beltColor = belt.color
    val current = level.level.toInt()
    val position = stringResource(R.string.stats_level_of, whole(level.level, locale), whole(LEVELS_PER_BELT, locale))

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.stats_belt_progression))

        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(belt.label), style = MaterialTheme.typography.titleSmall)
            Text(position, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            if (!level.isMaxLevel) {
                Text(
                    stringResource(R.string.stats_to_go, whole(level.bpToNextLevel, locale)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        // Ten levels in the belt's color: reached ones full, this one filling with Brain Power.
        Canvas(Modifier.fillMaxWidth().height(28.dp).clearAndSetSemantics { contentDescription = position }) {
            val gap = 4.dp.toPx()
            val width = (size.width - gap * (LEVELS_PER_BELT - 1)) / LEVELS_PER_BELT
            val radius = CornerRadius(3.dp.toPx())
            val hairline = 1.dp.toPx()

            for (index in 0 until LEVELS_PER_BELT.toInt()) {
                val left = index * (width + gap)
                val reached = index < current - 1 || level.isMaxLevel
                drawRoundRect(if (reached) beltColor else track, Offset(left, 0f), Size(width, size.height), radius)
                drawRoundRect(brain.copy(alpha = 0.25f), Offset(left, 0f), Size(width, size.height), radius, style = Stroke(hairline))
                if (index == current - 1 && !level.isMaxLevel) {
                    val height = size.height * share
                    drawRoundRect(brain, Offset(left, size.height - height), Size(width, height), radius)
                }
            }
        }

        if (nextBelt != null && level.nextBelt != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.stats_next_belt),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelLarge,
                )
                BeltDot(nextBelt)
                Text(
                    stringResource(R.string.stats_belt_at, stringResource(nextBelt.label), whole(level.nextBelt!!.startBrainPower, locale)),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            Text(stringResource(R.string.stats_every_belt), style = MaterialTheme.typography.bodyMedium)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Belt.entries.forEach { entry ->
                val name = stringResource(entry.label)
                Column(
                    modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = name },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    BeltDot(entry, if (entry == belt) Modifier.padding(2.dp) else Modifier)
                    if (entry == belt) Canvas(Modifier.size(4.dp)) { drawCircle(brain) }
                }
            }
        }
    }
}

// Energy

@Composable
internal fun EnergyPage(context: StatsContext) {
    val locale = currentLocale()
    val energy =
        context.stats.energy
            .collectShown()
            .value.value ?: return StatsEmpty(context)
    val insights = energy.insights

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_energy),
                            value = percent(energy.currentEnergy, locale),
                            detail = stringResource(R.string.stats_today),
                            tone = StatTone.Energy,
                            icon = tonedIcon(R.drawable.ic_bolt, StatTone.Energy),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_average),
                            value = insights?.let { percent(it.averageEnergy, locale) } ?: DASH,
                            detail = stringResource(R.string.stats_since_start),
                            tone = StatTone.Energy,
                            icon = tonedIcon(R.drawable.ic_speed, StatTone.Energy),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_full_energy),
                            value = insights?.let { whole(it.fullEnergyDays, locale) } ?: DASH,
                            detail = stringResource(R.string.stats_full_energy_days),
                            tone = StatTone.Energy,
                            icon = tonedIcon(R.drawable.ic_battery_full, StatTone.Energy),
                            modifier = modifier,
                        )
                    },
                ),
        )

        YearCalendar(
            title = stringResource(R.string.stats_past_year),
            days = energy.days.map { CalendarDay(it.date.toJavaLocalDate(), energyBand(it.energy)) },
            levels = ENERGY_LEVELS,
            color = MaterialTheme.zoonk.energy,
            low = stringResource(R.string.stats_low),
            high = stringResource(R.string.stats_high),
            summary =
                stringResource(
                    R.string.stats_calendar_energy_summary,
                    insights?.let { percent(it.averageEnergy, locale) } ?: DASH,
                    percent(energy.currentEnergy, locale),
                ),
            locale = locale,
        )

        StatsLine(stringResource(R.string.stats_energy_line))
    }
}

// Activity

@Composable
internal fun ActivityPage(context: StatsContext) {
    val locale = currentLocale()
    val activity =
        context.stats.activity
            .collectShown()
            .value.value ?: return StatsEmpty(context)
    if (activity.learningDays == 0L) return StatsEmpty(context)

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_study_days),
                            value = whole(activity.learningDays, locale),
                            detail = stringResource(R.string.stats_any_day_studied),
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_calendar_month, StatTone.Success),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_lessons),
                            value = whole(activity.totalLessonCompletions, locale),
                            detail = stringResource(R.string.stats_finished),
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_menu_book, StatTone.Success),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_time),
                            value = formatDuration(activity.totalLearningSeconds, locale),
                            detail = stringResource(R.string.stats_studying_total),
                            icon = icon(R.drawable.ic_schedule),
                            modifier = modifier,
                        )
                    },
                ),
        )

        ActivityCalendar(activity)
    }
}

@Composable
private fun ActivityCalendar(activity: com.zoonk.api.models.CurrentUserActivityResponseActivity) {
    val locale = currentLocale()
    val maximum = activity.days.maxOfOrNull { it.activitiesCompleted } ?: 0
    val active = activity.days.count { it.activitiesCompleted > 0 }

    YearCalendar(
        title = stringResource(R.string.stats_past_year),
        days = activity.days.map { CalendarDay(it.date.toJavaLocalDate(), activityBand(it.activitiesCompleted, maximum)) },
        levels = ACTIVITY_LEVELS,
        color = MaterialTheme.colorScheme.tertiary,
        low = stringResource(R.string.stats_less),
        high = stringResource(R.string.stats_more),
        summary =
            pluralStringResource(
                R.plurals.stats_calendar_activity_summary,
                active,
                active,
                pluralStringResource(R.plurals.stats_activities, maximum.toInt(), maximum.toInt()),
            ),
        locale = locale,
    )
}

// Score

@Composable
internal fun ScorePage(context: StatsContext) {
    val locale = currentLocale()
    val score =
        context.stats.score
            .collectShown()
            .value.value ?: return StatsEmpty(context)

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_score),
                            value = percent(score.score, locale),
                            detail = stringResource(R.string.stats_right_answers),
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_target, StatTone.Success),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        val correct = whole(score.correctAnswers, locale)
                        val total = whole(score.totalAnswers, locale)
                        val spoken = stringResource(R.string.stats_correct_of_total, correct, total)
                        StatTile(
                            label = stringResource(R.string.stats_right),
                            value = "$correct/$total",
                            detail = stringResource(R.string.stats_of_all_answers),
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_check_circle, StatTone.Success),
                            modifier = modifier.semantics { contentDescription = spoken },
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_period),
                            value = pluralStringResource(R.plurals.stats_days, SCORE_WINDOW_DAYS, SCORE_WINDOW_DAYS),
                            detail = stringResource(R.string.stats_back_from_today),
                            icon = icon(R.drawable.ic_date_range),
                            modifier = modifier,
                        )
                    },
                ),
        )

        ScoreChart(score.dataPoints.map { it.date.toJavaLocalDate() to it.score })
        StatsLine(stringResource(R.string.stats_score_line))
    }
}

/** The shared chart, so its points read out to TalkBack as every chart's do. */
@Composable
private fun ScoreChart(points: List<Pair<java.time.LocalDate, Double>>) {
    val locale = currentLocale()

    LessonVisual(
        LessonVisual.Chart(
            chart = LessonVisual.Chart.Kind.Line,
            title = stringResource(R.string.stats_score_90),
            categoryLabel = stringResource(R.string.stats_week),
            valueLabel = stringResource(R.string.stats_score_percent),
            categories = points.map { formatDate(it.first, locale, DateStyle.Day) },
            series = listOf(LessonVisual.Chart.Series(stringResource(R.string.stats_score), points.map { it.second })),
            axisStart = 0.0,
        ),
    )
}

// Patterns

@Composable
internal fun PatternsPage(context: StatsContext) {
    val locale = currentLocale()
    val patterns =
        context.stats.patterns
            .collectShown()
            .value.value ?: return StatsEmpty(context)
    val summary = patternsSummary(patterns)
    val answers = patterns.weekdays.sumOf { it.totalAnswers }

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_best_day),
                            value = bestDayName(summary.days) ?: DASH,
                            detail = verdictDetail(summary.days),
                            icon = icon(R.drawable.ic_calendar_month),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_best_time),
                            value = bestTimeName(summary.times) ?: DASH,
                            detail = verdictDetail(summary.times),
                            icon = icon(R.drawable.ic_schedule),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_answers),
                            value = whole(answers, locale),
                            detail = stringResource(R.string.stats_last_90),
                            icon = icon(R.drawable.ic_check_circle),
                            modifier = modifier,
                        )
                    },
                ),
        )

        PatternBars(
            stringResource(R.string.stats_throughout_week),
            patterns.weekdays.map { weekdayName(it.dayOfWeek.value, locale) to (it.score to it.totalAnswers) },
        )
        PatternBars(
            stringResource(R.string.stats_throughout_day),
            patterns.times.map { timeName(it.period.value) to (it.score to it.totalAnswers) },
        )
        PatternsNote(summary)
    }
}

/** One row per day or time of day: its score as a bar, and how many answers it has. */
@Composable
private fun PatternBars(
    title: String,
    rows: List<Pair<String, Pair<Double, Long>>>,
) {
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(title)
        rows.forEach { (name, result) ->
            val (score, answers) = result
            val counted = answers >= MIN_PATTERN_ANSWERS
            val count =
                if (answers ==
                    0L
                ) {
                    stringResource(R.string.stats_no_answers)
                } else {
                    pluralStringResource(R.plurals.stats_answer_count, answers.toInt(), answers.toInt())
                }

            Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        name.replaceFirstChar { it.titlecase(locale) },
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    if (counted) Text(percent(score, locale), style = MaterialTheme.typography.bodyMedium)
                    Text(count, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                Meter(if (counted) (score / PERCENT).toFloat() else 0f)
            }
        }
    }
}

@Composable
private fun PatternsNote(summary: PatternsSummary) {
    val sentences =
        listOfNotNull(
            (summary.days as? Verdict.Even)?.let { pluralStringResource(R.plurals.stats_days_even, it.points, it.points) },
            (summary.times as? Verdict.Even)?.let { pluralStringResource(R.plurals.stats_times_even, it.points, it.points) },
            pluralStringResource(R.plurals.stats_min_answers, MIN_PATTERN_ANSWERS.toInt(), MIN_PATTERN_ANSWERS.toInt()),
        )
    StatsLine(sentences.joinToString(" "))
}

internal sealed interface Verdict {
    data class Best(
        val key: String,
        val score: Double,
        val answers: Long,
    ) : Verdict

    data class Even(
        val points: Int,
    ) : Verdict

    data object NotEnough : Verdict
}

internal data class PatternsSummary(
    val days: Verdict,
    val times: Verdict,
)

/** Main's `getPatternVerdict`: a lone group has nothing to be better than, and a lead of a few points is noise. */
internal fun verdict(
    scores: List<Pair<Double, Long>>,
    strongest: Verdict.Best?,
): Verdict {
    val counted = scores.filter { it.second >= MIN_PATTERN_ANSWERS }.map { it.first }
    if (strongest == null || counted.size < 2) return Verdict.NotEnough
    val spread = counted.max() - counted.min()
    return if (spread < EVEN_SPREAD_POINTS) Verdict.Even(ceil(spread).toInt()) else strongest
}

internal fun patternsSummary(patterns: com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns) =
    PatternsSummary(
        days =
            verdict(
                patterns.weekdays.map { it.score to it.totalAnswers },
                patterns.strongestWeekday?.let { Verdict.Best(it.dayOfWeek.value, it.score, it.totalAnswers) },
            ),
        times =
            verdict(
                patterns.times.map { it.score to it.totalAnswers },
                patterns.strongestTime?.let { Verdict.Best(it.period.value, it.score, it.totalAnswers) },
            ),
    )

@Composable
private fun bestDayName(verdict: Verdict): String? =
    when (verdict) {
        is Verdict.Even -> stringResource(R.string.stats_any_day)
        is Verdict.Best -> weekdayName(verdict.key, currentLocale()).replaceFirstChar { it.titlecase(currentLocale()) }
        Verdict.NotEnough -> null
    }

@Composable
private fun bestTimeName(verdict: Verdict): String? =
    when (verdict) {
        is Verdict.Even -> stringResource(R.string.stats_any_time)
        is Verdict.Best -> timeName(verdict.key)
        Verdict.NotEnough -> null
    }

@Composable
private fun verdictDetail(verdict: Verdict): String =
    when (verdict) {
        is Verdict.Even -> {
            pluralStringResource(R.plurals.stats_within_points, verdict.points, verdict.points)
        }

        Verdict.NotEnough -> {
            stringResource(R.string.stats_not_enough)
        }

        is Verdict.Best -> {
            pluralStringResource(
                R.plurals.stats_score_answers,
                verdict.answers.toInt(),
                percent(verdict.score, currentLocale()),
                verdict.answers.toInt(),
            )
        }
    }

private fun Verdict.bestScore(locale: Locale): String? = (this as? Verdict.Best)?.let { percent(it.score, locale) }

private fun weekdayName(
    key: String,
    locale: Locale,
): String = DayOfWeek.valueOf(key.uppercase()).getDisplayName(TextStyle.FULL_STANDALONE, locale)

@Composable
private fun timeName(key: String): String =
    stringResource(
        when (key) {
            "night" -> R.string.stats_night
            "morning" -> R.string.stats_morning
            "afternoon" -> R.string.stats_afternoon
            else -> R.string.stats_evening
        },
    )

private const val PERCENT = 100.0
private const val DASH = "–"
private const val LEVELS_PER_BELT = 10L
private const val BRAIN_POWER_PER_LESSON = 10L
private const val SCORE_WINDOW_DAYS = 90
private const val MIN_PATTERN_ANSWERS = 10L
private const val EVEN_SPREAD_POINTS = 5.0
