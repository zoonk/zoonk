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
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatHourRange
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
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
    val level = progress.level

    val tiles =
        listOfNotNull<@Composable (Modifier) -> Unit>(
            level?.let { { modifier -> BeltTile(it, modifier) { context.open(StatsPage.Level) } } },
            progress.energy?.let { now ->
                { modifier ->
                    StatTile(
                        label = stringResource(R.string.stats_energy),
                        value = percent(now.currentEnergy, locale),
                        tone = StatTone.Energy,
                        icon = icon(R.drawable.ic_bolt),
                        onClick = { context.open(StatsPage.Energy) },
                        modifier = modifier,
                    )
                }
            },
            { modifier ->
                StatTile(
                    label = stringResource(R.string.stats_days_studied),
                    value = whole(progress.activity.learningDays, locale),
                    tone = StatTone.Success,
                    icon = icon(R.drawable.ic_bar_chart),
                    onClick = { context.open(StatsPage.Activity) },
                    modifier = modifier,
                )
            },
            { modifier ->
                StatTile(
                    label = stringResource(R.string.stats_score),
                    value = progress.score?.let { metricPercent(it.score, locale) } ?: DASH,
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
                    val days = patterns?.let { patternsSummary(it).days }
                    ListRow(
                        headline = { Text(stringResource(R.string.stats_patterns)) },
                        modifier = Modifier.bleed(LIST_ITEM_INSET),
                        onClick = { context.open(StatsPage.Patterns) },
                        trailing = {
                            PatternValue(
                                when (days) {
                                    is Verdict.Best -> stringResource(R.string.stats_best_on, weekdayName(days.key, locale))
                                    is Verdict.Even -> stringResource(R.string.stats_any_day)
                                    else -> stringResource(R.string.stats_not_yet)
                                },
                            )
                        },
                        chevron = true,
                    )
                }
            }
        }
    }
}

/** The belt's name over its number, as the top bar's mark says it: "White belt 2". */
@Composable
private fun BeltTile(
    level: CurrentUserProgressResponseLevel,
    modifier: Modifier,
    onClick: () -> Unit,
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
    val summary = patterns?.let { patternsSummary(it) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.stats_patterns_90)) {
            TextButton(onClick = { context.open(StatsPage.Patterns) }) { Text(stringResource(R.string.stats_see_all)) }
        }

        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            PatternRow(stringResource(R.string.stats_best_day), summary?.let { bestDayName(it.days) })
            ListDivider()
            PatternRow(stringResource(R.string.stats_best_time), summary?.let { bestTimeName(it.times) })
        }
    }
}

@Composable
private fun PatternRow(
    label: String,
    value: String?,
) {
    ListRow(headline = { Text(label) }, trailing = { PatternValue(value ?: stringResource(R.string.stats_not_yet)) })
}

/** The answer reads at the label's weight, not as a list item's quiet trailing text. */
@Composable
private fun PatternValue(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium)
}

// Belt

@Composable
internal fun LevelPage(context: StatsContext) {
    val level =
        context.stats.progress
            .collectShown()
            .value.value
            ?.level ?: return StatsEmpty(context)
    val belt = beltOf(level.belt.value)
    val nextBelt = level.nextBelt?.let { beltOf(it.belt.value) }

    BeltProgression(level, belt, nextBelt)
}

/**
 * Main's `LevelProgression`: a panel in the belt's tint with the belt and its number, its Brain Power,
 * the ten numbers drawn on the belt (the next one filling) and what the next number takes; then every
 * belt in order, and when the next belt comes.
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
    val name = stringResource(belt.label)

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = panel)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        stringResource(R.string.belt_level, name, whole(level.level, locale)),
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        stringResource(R.string.stats_brain_power_amount, whole(level.totalBrainPower, locale)),
                        color = MaterialTheme.zoonk.brainText,
                        style = MaterialTheme.typography.labelLarge.withTabularFigures(),
                    )
                }

                BeltDrawing(
                    belt,
                    level.level.toInt(),
                    share = if (level.isMaxLevel) null else level.progressInLevel.toFloat() / level.bpPerLevel.coerceAtLeast(1),
                    modifier = Modifier.bleedStart(16.dp),
                )
                NextStep(level, name, nextBelt)
            }
        }

        BeltRack(belt)

        val next = level.nextBelt
        if (nextBelt != null && next != null && level.level < LEVELS_PER_BELT) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                BeltDot(nextBelt)
                StatsLine(
                    stringResource(
                        R.string.stats_belt_comes_after,
                        stringResource(nextBelt.label),
                        name,
                        whole(LEVELS_PER_BELT, locale),
                        whole(next.startBrainPower, locale),
                    ),
                )
            }
        }
    }
}

/** After a belt's tenth number comes the next belt, so the line names that belt alone. */
@Composable
private fun NextStep(
    level: CurrentUserProgressResponseLevel,
    name: String,
    nextBelt: Belt?,
) {
    val locale = currentLocale()

    if (level.isMaxLevel) {
        Text(stringResource(R.string.stats_every_belt), style = MaterialTheme.typography.bodyMedium)
        return
    }

    val points = whole(level.bpToNextLevel, locale)
    StatsLine(
        if (nextBelt != null && level.level == LEVELS_PER_BELT) {
            stringResource(R.string.stats_brain_power_to, points, stringResource(nextBelt.label))
        } else {
            stringResource(R.string.stats_brain_power_to, points, stringResource(R.string.belt_level, name, whole(level.level + 1, locale)))
        },
    )
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
            columns = 2,
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
                            label = stringResource(R.string.stats_days_at_full),
                            value = insights?.let { whole(it.fullEnergyDays, locale) } ?: DASH,
                            tone = StatTone.Energy,
                            icon = icon(R.drawable.ic_battery_full),
                            modifier = modifier,
                        )
                    },
                ),
        )

        val days =
            energy.days.map { day ->
                val date = day.date.toJavaLocalDate()
                CalendarDay(
                    date = date,
                    band = energyBand(day.energy),
                    label = formatDate(date, locale, DateStyle.Day),
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
            summary = stringResource(R.string.stats_calendar_energy_summary, percent(energy.currentEnergy, locale)),
            inspector = context.inspector,
        )
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
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_calendar_month),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_lessons),
                            value = whole(activity.totalLessonCompletions, locale),
                            tone = StatTone.Success,
                            icon = icon(R.drawable.ic_menu_book),
                            modifier = modifier,
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.stats_time),
                            value = formatDuration(activity.totalLearningSeconds, locale),
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
    val days =
        activity.days.map { day ->
            val date = day.date.toJavaLocalDate()
            val lessons = day.lessonCompletions
            CalendarDay(
                date = date,
                band = activityBand(day.activitiesCompleted, maximum),
                label = formatDate(date, locale, DateStyle.Day),
                value =
                    when {
                        lessons > 0 -> pluralStringResource(R.plurals.stats_lesson_count, lessons.toInt(), whole(lessons, locale))
                        day.activitiesCompleted > 0 -> stringResource(R.string.stats_studied)
                        else -> stringResource(R.string.stats_no_study)
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
        summary = pluralStringResource(R.plurals.stats_calendar_activity_summary, active, whole(active.toLong(), locale)),
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
        StatTile(
            label = stringResource(R.string.stats_score),
            value = metricPercent(score.score, locale),
            modifier = Modifier.fillMaxWidth(),
            detail =
                pluralStringResource(
                    R.plurals.stats_right_in_last_days,
                    SCORE_WINDOW_DAYS,
                    whole(score.correctAnswers, locale),
                    whole(score.totalAnswers, locale),
                    whole(SCORE_WINDOW_DAYS.toLong(), locale),
                ),
            tone = StatTone.Success,
            icon = icon(R.drawable.ic_target),
        )
        ScoreChart(score)
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
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        Text(patternsSentence(summary), style = MaterialTheme.typography.titleMedium)

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

/** Main's patterns sentence: the best day, then the best time, each said only once the answers show it. */
@Composable
private fun patternsSentence(summary: PatternsSummary): String {
    val locale = currentLocale()
    val day =
        when (val days = summary.days) {
            is Verdict.Best -> stringResource(R.string.stats_best_day_is, weekdayName(days.key, locale))
            is Verdict.Even -> stringResource(R.string.stats_days_same)
            Verdict.NotEnough -> null
        }
    val time =
        when (val times = summary.times) {
            is Verdict.Best -> stringResource(R.string.stats_best_time_is, timeName(times.key).lowercase(locale))
            is Verdict.Even -> stringResource(R.string.stats_times_same)
            Verdict.NotEnough -> null
        }
    return listOfNotNull(day, time).joinSentences().ifEmpty { stringResource(R.string.stats_answer_more) }
}

private sealed interface Verdict {
    data class Best(
        val key: String,
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
        days = verdict(patterns.dayVerdict, patterns.strongestWeekday?.let { Verdict.Best(it.dayOfWeek.value) }),
        times = verdict(patterns.timeVerdict, patterns.strongestTime?.let { Verdict.Best(it.period.value) }),
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
private const val SCORE_WINDOW_DAYS = 90
private const val PANEL_TINT = 0.1f
