package com.zoonk.android.feature.stats

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltDot
import com.zoonk.android.ui.components.ChartInspector
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatHourRange
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.CurrentUserActivityResponseActivity
import com.zoonk.api.models.CurrentUserProgressResponse
import com.zoonk.api.models.CurrentUserProgressResponseLevel
import com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns
import com.zoonk.api.models.CurrentUserScoreResponseScore
import com.zoonk.api.models.ScorePatternVerdict
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale

/** Whole, as main shows Energy now and the patterns. */
private fun percent(
    value: Double,
    locale: Locale,
) = formatPercent(value / PERCENT, locale)

/** Main's `formatMetricPercent`, for scores and averages: "66.7%", "67%". */
internal fun metricPercent(
    value: Double,
    locale: Locale,
) = formatPercent(value / PERCENT, locale, maximumFractionDigits = 1)

private fun whole(
    value: Long,
    locale: Locale,
) = formatNumber(value.toDouble(), locale, maximumFractionDigits = 0)

@Composable
private fun icon(id: Int): @Composable (Modifier) -> Unit =
    { modifier -> Icon(painterResource(id), contentDescription = null, modifier = modifier) }

private fun beltOf(color: String) = Belt.entries.first { it.name.equals(color, ignoreCase = true) }

/** A read the overview shows beside its own: a wheel while nothing is cached, and a retry when it failed. */
@Composable
private fun <T : Any> Beside(
    resource: Resource<T>,
    content: @Composable (T?) -> Unit,
) {
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()

    when (val shown = state) {
        LoadState.Idle, LoadState.Loading -> {
            Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(24.dp))
            }
        }

        is LoadState.Failed -> {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.stats_part_failed),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(onClick = { scope.launch { resource.refresh() } }) { Text(stringResource(R.string.load_failed_try_again)) }
            }
        }

        else -> {
            content(shown.value)
        }
    }
}

// Overview

@Composable
internal fun StatsOverview(context: StatsContext) {
    val progress =
        context.stats.progress
            .collectShown()
            .value.value

    if (progress == null || !(progress.activity.learningDays > 0 || progress.level != null)) {
        StatsEmpty(context)
    } else {
        OverviewContent(context, progress)
    }
}

/** Only a learner with stats reads the rest, so an empty overview never loads them. */
@Composable
private fun OverviewContent(
    context: StatsContext,
    progress: CurrentUserProgressResponse,
) {
    val locale = currentLocale()
    val energy by context.stats.energy.collectShown()
    val level = progress.level

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
                                stringResource(R.string.stats_energy_average, metricPercent(it.averageEnergy, locale))
                            },
                        tone = StatTone.Energy,
                        icon = icon(R.drawable.ic_bolt),
                        onClick = { context.open(StatsPage.Energy) },
                        modifier = modifier,
                    )
                }
            },
            { modifier ->
                val lessons = progress.activity.totalLessonCompletions
                StatTile(
                    label = stringResource(R.string.stats_days_studied),
                    value = whole(progress.activity.learningDays, locale),
                    detail =
                        pluralStringResource(
                            R.plurals.stats_lessons_time,
                            lessons.toInt(),
                            whole(lessons, locale),
                            formatDuration(progress.activity.totalLearningSeconds, locale),
                        ),
                    tone = StatTone.Success,
                    icon = icon(R.drawable.ic_bar_chart),
                    onClick = { context.open(StatsPage.Activity) },
                    modifier = modifier,
                )
            },
            { modifier ->
                val score = progress.score
                StatTile(
                    label = stringResource(R.string.stats_score),
                    value = score?.let { metricPercent(it.score, locale) } ?: stringResource(R.string.stats_not_yet),
                    detail =
                        score?.let {
                            stringResource(R.string.stats_right_count, whole(it.correctAnswers, locale), whole(it.totalAnswers, locale))
                        } ?: stringResource(R.string.stats_right_last_90),
                    tone = StatTone.Success,
                    icon = icon(R.drawable.ic_target),
                    onClick = { context.open(StatsPage.Score) },
                    modifier = modifier,
                )
            },
        )

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(columns = if (context.wide) 4 else 2, tiles = tiles)
        Beside(context.stats.activity) { activity -> activity?.let { ActivityCalendar(it, context.inspector) } }

        // Main shows the trend and the patterns from `md`, side by side from `lg`; narrower, a row leads to the patterns.
        when {
            context.expanded -> {
                Row(horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                    Column(Modifier.weight(1.25f)) { Beside(context.stats.score) { ScoreTrend(it) } }
                    Column(Modifier.weight(1f)) { Beside(context.stats.patterns) { PatternsOverview(context, it) } }
                }
            }

            context.wide -> {
                Beside(context.stats.score) { ScoreTrend(it) }
                Beside(context.stats.patterns) { PatternsOverview(context, it) }
            }

            else -> {
                Beside(context.stats.patterns) { patterns ->
                    val summary = patterns?.let { patternsSummary(it) }
                    val names = listOfNotNull(summary?.let { bestDayName(it.days) }, summary?.let { bestTimeName(it.times) })
                    ListRow(
                        headline = { Text(stringResource(R.string.stats_patterns)) },
                        modifier = Modifier.bleed(LIST_ITEM_INSET),
                        onClick = { context.open(StatsPage.Patterns) },
                        trailing = {
                            PatternValue(names.factsLine().ifEmpty { stringResource(R.string.stats_not_yet) })
                        },
                        chevron = true,
                    )
                }
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
private fun ScoreTrend(score: CurrentUserScoreResponseScore?) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // As tall as the patterns' "See all" beside it, so the two headers line up.
        Box(Modifier.heightIn(min = LocalMinimumInteractiveComponentSize.current), contentAlignment = Alignment.CenterStart) {
            SectionHeader(stringResource(R.string.stats_score_90), detail = score?.let { metricPercent(it.score, currentLocale()) })
        }

        if (score == null) StatsLine(stringResource(R.string.stats_score_after_answers)) else ScoreChart(score)
    }
}

@Composable
private fun PatternsOverview(
    context: StatsContext,
    patterns: CurrentUserScorePatternsResponsePatterns?,
) {
    val locale = currentLocale()
    val summary = patterns?.let { patternsSummary(it) }
    val spread = patterns?.weekSpread?.let { stringResource(R.string.stats_range, percent(it.low, locale), percent(it.high, locale)) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.stats_patterns_90)) {
            TextButton(onClick = { context.open(StatsPage.Patterns) }) { Text(stringResource(R.string.stats_see_all)) }
        }

        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            PatternRow(stringResource(R.string.stats_best_day), summary?.let { bestDayName(it.days) }, summary?.days?.bestScore(locale))
            ListDivider()
            PatternRow(stringResource(R.string.stats_best_time), summary?.let { bestTimeName(it.times) }, summary?.times?.bestScore(locale))
            spread?.let {
                ListDivider()
                PatternRow(stringResource(R.string.stats_week_spread), it, null)
            }
        }

        if (patterns != null && summary != null) PatternsNote(summary, patterns.minimumAnswers)
    }
}

@Composable
private fun PatternRow(
    label: String,
    value: String?,
    score: String?,
) {
    ListRow(
        headline = { Text(label) },
        trailing = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                PatternValue(value ?: stringResource(R.string.stats_not_yet))
                score?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.zoonkType.data)
                }
            }
        },
    )
}

/** The answer reads at the label's weight, not as a list item's quiet trailing text. */
@Composable
private fun PatternValue(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium)
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
                            icon = icon(R.drawable.ic_psychology),
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
        value = stringResource(R.string.stats_brain_power_amount, whole(level.bpToNextLevel, locale)),
        icon = icon(R.drawable.ic_keyboard_double_arrow_up),
        modifier = modifier,
        footer = { Meter(level.progressInLevel.toFloat() / level.bpPerLevel.coerceAtLeast(1), color = MaterialTheme.zoonk.brain) },
    )
}

/**
 * Main's belt progression: a panel in the belt's tint with its ten levels (those reached in the
 * belt's color, the next one filling with Brain Power), the next belt and how far it is, then every
 * belt in order, the earned ones full and the current one ringed.
 */
@Composable
private fun BeltProgression(
    level: CurrentUserProgressResponseLevel,
    belt: Belt,
    nextBelt: Belt?,
) {
    val locale = currentLocale()
    val surface = MaterialTheme.colorScheme.surfaceContainerLow
    // White and black would wash the panel white or gray, so theirs stays neutral, as on main.
    val panel =
        if (belt == Belt.White ||
            belt == Belt.Black
        ) {
            MaterialTheme.colorScheme.surfaceContainerHigh
        } else {
            lerp(surface, belt.color, PANEL_TINT)
        }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionHeader(stringResource(R.string.stats_belt_progression))

        Card(colors = CardDefaults.cardColors(containerColor = panel)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(stringResource(belt.label), style = MaterialTheme.typography.titleMedium)
                    Text(
                        stringResource(R.string.stats_level_of, whole(level.level, locale), whole(LEVELS_PER_BELT, locale)),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                BeltDrawing(
                    belt,
                    level.level.toInt(),
                    share = if (level.isMaxLevel) null else level.progressInLevel.toFloat() / level.bpPerLevel.coerceAtLeast(1),
                    modifier = Modifier.bleedStart(16.dp),
                )
                NextBelt(level, nextBelt)
            }
        }

        BeltRack(belt)
    }
}

@Composable
private fun NextBelt(
    level: CurrentUserProgressResponseLevel,
    nextBelt: Belt?,
) {
    val locale = currentLocale()
    val next = level.nextBelt

    if (nextBelt == null || next == null) {
        Text(stringResource(R.string.stats_every_belt), style = MaterialTheme.typography.bodyMedium)
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val heading = stringResource(R.string.stats_next_belt)
        Text(
            heading.uppercase(locale),
            Modifier.semantics { contentDescription = heading },
            color = MaterialTheme.zoonk.faint,
            style = MaterialTheme.zoonkType.label,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BeltDot(nextBelt)
            Text(
                stringResource(R.string.stats_belt_at, stringResource(nextBelt.label), whole(next.startBrainPower, locale)),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        Text(
            stringResource(R.string.stats_to_go, whole(next.brainPowerToGo, locale)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
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
                            icon = icon(R.drawable.ic_bolt),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_average),
                            value = insights?.let { metricPercent(it.averageEnergy, locale) } ?: DASH,
                            detail = stringResource(R.string.stats_since_start),
                            tone = StatTone.Energy,
                            icon = icon(R.drawable.ic_speed),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_full_energy),
                            value =
                                insights?.let {
                                    pluralStringResource(R.plurals.stats_days, it.fullEnergyDays.toInt(), whole(it.fullEnergyDays, locale))
                                } ?: DASH,
                            detail = stringResource(R.string.stats_full_energy_days),
                            tone = StatTone.Energy,
                            icon = icon(R.drawable.ic_battery_full),
                            modifier = modifier,
                        )
                    },
                ),
        )

        val newest =
            energy.days
                .lastOrNull()
                ?.date
                ?.toJavaLocalDate()
        val days =
            energy.days.map { day ->
                val date = day.date.toJavaLocalDate()
                CalendarDay(
                    date = date,
                    band = energyBand(day.energy),
                    label = formatDate(date, locale, DateStyle.Day, today = newest ?: date),
                    value =
                        day.energy?.let { stringResource(R.string.stats_energy_amount, metricPercent(it, locale)) }
                            ?: stringResource(R.string.stats_no_energy),
                )
            }

        YearCalendar(
            title = stringResource(R.string.stats_past_year),
            days = days,
            shades = ENERGY_SHADES,
            color = MaterialTheme.zoonk.energy,
            low = stringResource(R.string.stats_low),
            high = stringResource(R.string.stats_high),
            summary =
                stringResource(
                    R.string.stats_calendar_energy_summary,
                    percent(energy.currentEnergy, locale),
                    insights?.let { metricPercent(it.averageEnergy, locale) } ?: DASH,
                ),
            inspector = context.inspector,
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
            .value.value
    if (activity == null || activity.learningDays == 0L) return StatsEmpty(context)

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_days_studied),
                            value = whole(activity.learningDays, locale),
                            detail = stringResource(R.string.stats_any_day_studied),
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_calendar_month),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_lessons),
                            value = whole(activity.totalLessonCompletions, locale),
                            detail = stringResource(R.string.stats_finished),
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_menu_book),
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

        ActivityCalendar(activity, context.inspector)
    }
}

@Composable
private fun ActivityCalendar(
    activity: CurrentUserActivityResponseActivity,
    inspector: ChartInspector,
) {
    val locale = currentLocale()
    val maximum = activity.days.maxOfOrNull { it.activitiesCompleted } ?: 0
    val active = activity.days.count { it.activitiesCompleted > 0 }
    val newest =
        activity.days
            .lastOrNull()
            ?.date
            ?.toJavaLocalDate()
    val days =
        activity.days.map { day ->
            val date = day.date.toJavaLocalDate()
            val count = day.activitiesCompleted
            CalendarDay(
                date = date,
                band = activityBand(count, maximum),
                label = formatDate(date, locale, DateStyle.Day, today = newest ?: date),
                value =
                    if (count == 0L) {
                        stringResource(R.string.stats_no_study)
                    } else {
                        pluralStringResource(R.plurals.stats_activities, count.toInt(), whole(count, locale))
                    },
            )
        }

    YearCalendar(
        title = stringResource(R.string.stats_past_year),
        days = days,
        shades = ACTIVITY_SHADES,
        color = MaterialTheme.colorScheme.tertiary,
        low = stringResource(R.string.stats_less),
        high = stringResource(R.string.stats_more),
        summary =
            pluralStringResource(
                R.plurals.stats_calendar_activity_summary,
                active,
                whole(active.toLong(), locale),
                pluralStringResource(R.plurals.stats_activities, maximum.toInt(), whole(maximum, locale)),
            ),
        inspector = inspector,
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
                            value = metricPercent(score.score, locale),
                            detail = stringResource(R.string.stats_right_answers),
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_target),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        val correct = whole(score.correctAnswers, locale)
                        val total = whole(score.totalAnswers, locale)
                        StatTile(
                            label = stringResource(R.string.stats_right),
                            value = "$correct/$total",
                            spokenValue = stringResource(R.string.stats_correct_of_total, correct, total),
                            detail = stringResource(R.string.stats_of_all_answers),
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_check_circle),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_period),
                            value =
                                pluralStringResource(
                                    R.plurals.stats_days,
                                    SCORE_WINDOW_DAYS,
                                    whole(SCORE_WINDOW_DAYS.toLong(), locale),
                                ),
                            detail = stringResource(R.string.stats_back_from_today),
                            icon = icon(R.drawable.ic_date_range),
                            modifier = modifier,
                        )
                    },
                ),
        )

        ScoreChart(score)
        StatsLine(stringResource(R.string.stats_score_line))
    }
}

// Patterns

@Composable
internal fun PatternsPage(context: StatsContext) {
    val locale = currentLocale()
    val is24Hour =
        android.text.format.DateFormat
            .is24HourFormat(LocalContext.current)
    val patterns =
        context.stats.patterns
            .collectShown()
            .value.value ?: return StatsEmpty(context)
    val summary = patternsSummary(patterns)
    val answers = patterns.weekdays.sumOf { it.totalAnswers }
    val bestDay = (summary.days as? Verdict.Best)?.key
    val bestTime = (summary.times as? Verdict.Best)?.key
    val fullBar = if (context.wide) WIDE_PATTERN_BAR else PATTERN_BAR

    val week: @Composable (Modifier) -> Unit = { modifier ->
        PatternChart(
            title = stringResource(R.string.stats_throughout_week),
            bestLabel = stringResource(R.string.stats_best_day),
            columns =
                patterns.weekdays.map {
                    patternColumn(
                        name = weekdayName(it.dayOfWeek.value, locale),
                        pattern = Pattern(it.score, it.totalAnswers, best = it.dayOfWeek.value == bestDay),
                        minimumAnswers = patterns.minimumAnswers,
                        label = weekdayName(it.dayOfWeek.value, locale, TextStyle.SHORT_STANDALONE),
                    )
                },
            fullBar = fullBar,
            inspector = context.inspector,
            modifier = modifier,
            footer = (summary.days as? Verdict.Even)?.let { pluralStringResource(R.plurals.stats_days_even, it.points, it.points) },
        )
    }
    val day: @Composable (Modifier) -> Unit = { modifier ->
        PatternChart(
            title = stringResource(R.string.stats_throughout_day),
            bestLabel = stringResource(R.string.stats_best_time),
            columns =
                DAY_ORDER.mapNotNull { period -> patterns.times.find { it.period.value == period } }.map {
                    val hours = TIME_HOURS.getValue(it.period.value)
                    patternColumn(
                        name = timeName(it.period.value),
                        pattern = Pattern(it.score, it.totalAnswers, best = it.period.value == bestTime),
                        minimumAnswers = patterns.minimumAnswers,
                        hours = formatHourRange(hours.first, hours.last, locale, is24Hour),
                        icon = timeIcon(it.period.value),
                    )
                },
            fullBar = fullBar,
            inspector = context.inspector,
            modifier = modifier,
            footer = (summary.times as? Verdict.Even)?.let { pluralStringResource(R.plurals.stats_times_even, it.points, it.points) },
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatsLine(stringResource(R.string.stats_patterns_intro))
        StatTiles(
            columns = if (context.wide) 3 else 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_best_day),
                            value = bestDayName(summary.days) ?: DASH,
                            detail = verdictDetail(summary.days),
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_calendar_month),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_best_time),
                            value = bestTimeName(summary.times) ?: DASH,
                            detail = verdictDetail(summary.times),
                            tone = StatTone.Success,
                            icon = icon(bestTime?.let(::timeIcon) ?: R.drawable.ic_schedule),
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

        BoxWithConstraints {
            if (maxWidth >= PATTERNS_BESIDE) {
                Row(horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                    week(Modifier.weight(1f))
                    day(Modifier.weight(1f))
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
                    week(Modifier)
                    day(Modifier)
                }
            }
        }

        PatternsNote(summary = null, patterns.minimumAnswers)
    }
}

private class Pattern(
    val score: Double,
    val answers: Long,
    val best: Boolean,
)

/** A group without answers says so instead of reading as 0%. */
@Composable
private fun patternColumn(
    name: String,
    pattern: Pattern,
    minimumAnswers: Long,
    label: String = name,
    hours: String? = null,
    @DrawableRes icon: Int? = null,
): PatternColumn {
    val locale = currentLocale()
    val count = whole(pattern.answers, locale)
    val state =
        when {
            pattern.answers == 0L -> PatternState.None
            pattern.answers < minimumAnswers -> PatternState.Few
            pattern.best -> PatternState.Best
            else -> PatternState.Counted
        }

    return PatternColumn(
        name = name,
        label = label,
        state = state,
        share = (pattern.score.coerceIn(0.0, PERCENT) / PERCENT).toFloat(),
        value = if (state == PatternState.None) stringResource(R.string.stats_no_answers) else percent(pattern.score, locale),
        note =
            when (state) {
                PatternState.None -> {
                    null
                }

                PatternState.Few -> {
                    pluralStringResource(
                        R.plurals.stats_answers_to_count,
                        pattern.answers.toInt(),
                        count,
                        whole(minimumAnswers, locale),
                    )
                }

                else -> {
                    pluralStringResource(R.plurals.stats_answer_count, pattern.answers.toInt(), count)
                }
            },
        hours = hours,
        icon = icon,
    )
}

/** Without [summary] it leaves out what each chart says under itself. */
@Composable
private fun PatternsNote(
    summary: PatternsSummary?,
    minimumAnswers: Long,
) {
    val sentences =
        listOfNotNull(
            (summary?.days as? Verdict.Even)?.let { pluralStringResource(R.plurals.stats_days_even, it.points, it.points) },
            (summary?.times as? Verdict.Even)?.let { pluralStringResource(R.plurals.stats_times_even, it.points, it.points) },
            pluralStringResource(R.plurals.stats_min_answers, minimumAnswers.toInt(), minimumAnswers.toInt()),
        )
    StatsLine(sentences.joinSentences())
}

private sealed interface Verdict {
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

private data class PatternsSummary(
    val days: Verdict,
    val times: Verdict,
)

/** The API's verdict, with the strongest group it names when it's the best. */
private fun verdict(
    verdict: ScorePatternVerdict,
    strongest: Verdict.Best?,
): Verdict =
    when (verdict.kind) {
        ScorePatternVerdict.Kind.BEST -> strongest ?: Verdict.NotEnough
        ScorePatternVerdict.Kind.EVEN -> Verdict.Even(verdict.points?.toInt() ?: 0)
        ScorePatternVerdict.Kind.NOT_ENOUGH -> Verdict.NotEnough
    }

private fun patternsSummary(patterns: CurrentUserScorePatternsResponsePatterns) =
    PatternsSummary(
        days = verdict(patterns.dayVerdict, patterns.strongestWeekday?.let { Verdict.Best(it.dayOfWeek.value, it.score, it.totalAnswers) }),
        times = verdict(patterns.timeVerdict, patterns.strongestTime?.let { Verdict.Best(it.period.value, it.score, it.totalAnswers) }),
    )

@Composable
private fun bestDayName(verdict: Verdict): String? =
    when (verdict) {
        is Verdict.Even -> stringResource(R.string.stats_any_day)
        is Verdict.Best -> weekdayName(verdict.key, currentLocale())
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
                whole(verdict.answers, currentLocale()),
            )
        }
    }

private fun Verdict.bestScore(locale: Locale): String? = (this as? Verdict.Best)?.let { percent(it.score, locale) }

private fun weekdayName(
    key: String,
    locale: Locale,
    style: TextStyle = TextStyle.FULL_STANDALONE,
): String = DayOfWeek.valueOf(key.uppercase()).getDisplayName(style, locale).replaceFirstChar { it.titlecase(locale) }

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

/** Main's sunrise, sun, sunset and moon, as [com.zoonk.android.feature.activities.sorting] maps lucide's. */
@DrawableRes
private fun timeIcon(key: String): Int =
    when (key) {
        "night" -> R.drawable.ic_dark_mode
        "morning" -> R.drawable.ic_wb_twilight
        "afternoon" -> R.drawable.ic_sunny
        else -> R.drawable.ic_nights_stay
    }

/** Main's `TIME_PERIOD_HOURS`, in the learner's own time zone. */
private val TIME_HOURS = mapOf("night" to 0..6, "morning" to 6..12, "afternoon" to 12..18, "evening" to 18..24)

/** The API counts periods from midnight; a learner's day runs from the morning to the night after it. */
private val DAY_ORDER = listOf("morning", "afternoon", "evening", "night")

private val PATTERN_BAR = 112.dp
private val WIDE_PATTERN_BAR = 144.dp
private val PATTERNS_BESIDE = 720.dp
private const val PERCENT = 100.0
private const val DASH = "–"
private const val LEVELS_PER_BELT = 10L
private const val BRAIN_POWER_PER_LESSON = 10L
private const val SCORE_WINDOW_DAYS = 90
private const val PANEL_TINT = 0.1f
