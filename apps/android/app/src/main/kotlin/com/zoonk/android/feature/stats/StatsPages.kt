package com.zoonk.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltDot
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
import com.zoonk.android.ui.format.formatHourRange
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.CurrentUserActivityResponseActivity
import com.zoonk.api.models.CurrentUserProgressResponse
import com.zoonk.api.models.CurrentUserProgressResponseLevel
import com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns
import com.zoonk.api.models.CurrentUserScoreResponseScore
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.ceil

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

@Composable
private fun tonedIcon(
    id: Int,
    tone: StatTone,
): @Composable (Modifier) -> Unit {
    val tint = tone.color
    return { modifier -> Icon(painterResource(id), contentDescription = null, modifier = modifier, tint = tint) }
}

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
                        icon = tonedIcon(R.drawable.ic_bolt, StatTone.Energy),
                        onClick = { context.open(StatsPage.Energy) },
                        modifier = modifier,
                    )
                }
            },
            { modifier ->
                val lessons = progress.activity.totalLessonCompletions
                StatTile(
                    label = stringResource(R.string.stats_study_days),
                    value = whole(progress.activity.learningDays, locale),
                    detail =
                        pluralStringResource(
                            R.plurals.stats_lessons_time,
                            lessons.toInt(),
                            whole(lessons, locale),
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
                    value = score?.let { metricPercent(it.score, locale) } ?: stringResource(R.string.stats_not_yet),
                    detail =
                        score?.let {
                            stringResource(R.string.stats_right_count, whole(it.correctAnswers, locale), whole(it.totalAnswers, locale))
                        } ?: stringResource(R.string.stats_right_last_90),
                    tone = StatTone.Success,
                    icon = tonedIcon(R.drawable.ic_target, StatTone.Success),
                    onClick = { context.open(StatsPage.Score) },
                    modifier = modifier,
                )
            },
        )

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        StatTiles(columns = if (context.wide) 4 else 2, tiles = tiles)
        Beside(context.stats.activity) { activity -> activity?.let { ActivityCalendar(it) } }

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
                    OutlinedCard(onClick = { context.open(StatsPage.Patterns) }) {
                        ListItem(
                            headlineContent = { Text(stringResource(R.string.stats_patterns)) },
                            trailingContent = {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    PatternValue(names.joinToString(" · ").ifEmpty { stringResource(R.string.stats_not_yet) })
                                    Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null)
                                }
                            },
                        )
                    }
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
        Row(
            Modifier.heightIn(min = LocalMinimumInteractiveComponentSize.current),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SectionHeader(stringResource(R.string.stats_score_90), Modifier.weight(1f))
            score?.let {
                Text(
                    metricPercent(it.score, currentLocale()),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                )
            }
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

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
        trailingContent = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PatternValue(value ?: stringResource(R.string.stats_not_yet))
                score?.let {
                    Text(
                        it,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                    )
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

                LevelStripes(level, belt)
                NextBelt(level, nextBelt)
            }
        }

        BeltRack(belt)
    }
}

/** Drawn for the eye only: the words above it name the belt and level. */
@Composable
private fun LevelStripes(
    level: CurrentUserProgressResponseLevel,
    belt: Belt,
) {
    val locale = currentLocale()
    val reached = level.level.toInt()
    val share = level.progressInLevel.toFloat() / level.bpPerLevel.coerceAtLeast(1)
    val brain = MaterialTheme.zoonk.brain
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val edge = MaterialTheme.colorScheme.outlineVariant
    val beltColor = belt.color

    Row(Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for (index in 0 until LEVELS_PER_BELT.toInt()) {
            Column(
                Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Canvas(Modifier.fillMaxWidth().height(28.dp)) {
                    val radius = CornerRadius(3.dp.toPx())
                    drawRoundRect(if (index < reached) beltColor else track, cornerRadius = radius)
                    drawRoundRect(edge, cornerRadius = radius, style = Stroke(1.dp.toPx()))
                    if (index == reached && !level.isMaxLevel) {
                        val height = size.height * share
                        drawRoundRect(brain, Offset(0f, size.height - height), Size(size.width, height), radius)
                    }
                }
                Text(
                    whole(index + 1L, locale),
                    color = if (index + 1 == reached) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                    fontWeight = if (index + 1 == reached) FontWeight.SemiBold else null,
                )
            }
        }
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
        Text(
            stringResource(R.string.stats_next_belt),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
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

/** Every belt in order: earned ones full, the current one ringed, those ahead faint (main's tied and folded belts). */
@Composable
private fun BeltRack(current: Belt) {
    val ring = MaterialTheme.colorScheme.onSurface
    val earned = stringResource(R.string.stats_belt_earned)
    val now = stringResource(R.string.stats_belt_current)

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Belt.entries.forEach { entry ->
            val name = stringResource(entry.label)
            Box(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .then(if (entry == current) Modifier.border(1.5.dp, ring, CircleShape) else Modifier)
                        .padding(4.dp)
                        .alpha(if (entry > current) AHEAD_ALPHA else 1f)
                        .clearAndSetSemantics {
                            contentDescription = name
                            when {
                                entry == current -> stateDescription = now
                                entry < current -> stateDescription = earned
                                else -> Unit
                            }
                        },
            ) {
                BeltDot(entry)
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
                            value = insights?.let { metricPercent(it.averageEnergy, locale) } ?: DASH,
                            detail = stringResource(R.string.stats_since_start),
                            tone = StatTone.Energy,
                            icon = tonedIcon(R.drawable.ic_speed, StatTone.Energy),
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
                            icon = tonedIcon(R.drawable.ic_battery_full, StatTone.Energy),
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
                val date = formatDate(day.date.toJavaLocalDate(), locale, DateStyle.Day, today = newest ?: day.date.toJavaLocalDate())
                val label =
                    day.energy?.let { stringResource(R.string.stats_day_energy, date, metricPercent(it, locale)) }
                        ?: stringResource(R.string.stats_day_no_energy, date)
                CalendarDay(day.date.toJavaLocalDate(), energyBand(day.energy), label)
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
            start = energy.days.indexOfLast { it.energy != null }.takeIf { it >= 0 } ?: energy.days.lastIndex,
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
private fun ActivityCalendar(activity: CurrentUserActivityResponseActivity) {
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
            val date = formatDate(day.date.toJavaLocalDate(), locale, DateStyle.Day, today = newest ?: day.date.toJavaLocalDate())
            val count = day.activitiesCompleted
            val label =
                if (count == 0L) {
                    stringResource(R.string.stats_day_no_study, date)
                } else {
                    pluralStringResource(R.plurals.stats_day_activities, count.toInt(), date, whole(count, locale))
                }
            CalendarDay(day.date.toJavaLocalDate(), activityBand(count, maximum), label)
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
        start = activity.days.indexOfLast { it.activitiesCompleted > 0 }.takeIf { it >= 0 } ?: activity.days.lastIndex,
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
                            icon = tonedIcon(R.drawable.ic_target, StatTone.Success),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_right),
                            value = whole(score.correctAnswers, locale) + "/" + whole(score.totalAnswers, locale),
                            detail = stringResource(R.string.stats_of_all_answers),
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_check_circle, StatTone.Success),
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
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_calendar_month, StatTone.Success),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_best_time),
                            value = bestTimeName(summary.times) ?: DASH,
                            detail = verdictDetail(summary.times),
                            tone = StatTone.Success,
                            icon = tonedIcon(R.drawable.ic_schedule, StatTone.Success),
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
            patterns.weekdays.map {
                PatternBar(weekdayName(it.dayOfWeek.value, locale), null, it.score, it.totalAnswers, it.dayOfWeek.value == bestDay)
            },
        )
        PatternBars(
            stringResource(R.string.stats_throughout_day),
            patterns.times.map {
                val hours = TIME_HOURS.getValue(it.period.value)
                PatternBar(
                    name = timeName(it.period.value),
                    hours = formatHourRange(hours.first, hours.last, locale, is24Hour),
                    score = it.score,
                    answers = it.totalAnswers,
                    best = it.period.value == bestTime,
                )
            },
        )
        PatternsNote(summary)
    }
}

private data class PatternBar(
    val name: String,
    val hours: String?,
    val score: Double,
    val answers: Long,
    val best: Boolean,
)

/** Main's rows: a group with too few answers to count stays gray, so a lucky answer never reads as a result. */
@Composable
private fun PatternBars(
    title: String,
    rows: List<PatternBar>,
) {
    val locale = currentLocale()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    if (rows.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(title)
        rows.forEach { row ->
            val counted = row.answers >= MIN_PATTERN_ANSWERS
            val count =
                if (row.answers == 0L) {
                    stringResource(R.string.stats_no_answers)
                } else {
                    pluralStringResource(R.plurals.stats_answer_count, row.answers.toInt(), whole(row.answers, locale))
                }
            val bar =
                when {
                    !counted -> MaterialTheme.colorScheme.onSurface.copy(alpha = UNCOUNTED_BAR_ALPHA)
                    row.best -> MaterialTheme.colorScheme.tertiary
                    else -> MaterialTheme.colorScheme.tertiary.copy(alpha = OTHER_BAR_ALPHA)
                }

            Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        row.name.replaceFirstChar { it.titlecase(locale) },
                        modifier = Modifier.alignByBaseline(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (row.best) FontWeight.Medium else null,
                    )
                    row.hours?.let {
                        Text(
                            it,
                            modifier = Modifier.alignByBaseline(),
                            color = muted,
                            style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                        )
                    }
                    Box(Modifier.weight(1f))
                    Text(
                        if (row.answers > 0) percent(row.score, locale) else DASH,
                        modifier = Modifier.alignByBaseline(),
                        color = if (counted) MaterialTheme.colorScheme.onSurface else muted,
                        style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                    )
                }
                Text(count, color = muted, style = MaterialTheme.typography.bodySmall.withTabularFigures())
                Meter(if (row.answers > 0) (row.score / PERCENT).toFloat() else 0f, color = bar)
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

internal fun patternsSummary(patterns: CurrentUserScorePatternsResponsePatterns) =
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
                whole(verdict.answers, currentLocale()),
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

/** Main's `TIME_PERIOD_HOURS`, in the learner's own time zone. */
private val TIME_HOURS = mapOf("night" to 0..6, "morning" to 6..12, "afternoon" to 12..18, "evening" to 18..24)

private const val PERCENT = 100.0
private const val DASH = "–"
private const val LEVELS_PER_BELT = 10L
private const val BRAIN_POWER_PER_LESSON = 10L
private const val SCORE_WINDOW_DAYS = 90
internal const val MIN_PATTERN_ANSWERS = 10L
private const val EVEN_SPREAD_POINTS = 5.0
private const val PANEL_TINT = 0.1f
private const val AHEAD_ALPHA = 0.38f
private const val UNCOUNTED_BAR_ALPHA = 0.2f
private const val OTHER_BAR_ALPHA = 0.45f
