package com.zoonk.android.feature.recap

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.GoalRing
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.weekdayNames
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.ResultPages
import com.zoonk.android.ui.scaffold.ResultScreen
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.WeeklyRecap
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.plus
import kotlinx.datetime.toJavaLocalDate

/** The week's summary; nothing in it is written by a model. */
@Composable
fun LogbookScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val learner = summary.value
    val goalId = learner?.activeGoalId

    // A guest has no name of their own: their placeholder would read "What a week, Guest!".
    val name =
        learner
            ?.takeIf { !it.identity.isAnonymous }
            ?.account
            ?.name
            ?.split(" ")
            ?.firstOrNull()
            ?.takeIf { it.isNotBlank() }
    // Leaving goes to the buddy, where the week is told; Done goes to today.
    val close = { navigator.showRoot(AppTab.Buddy) }

    if (goalId == null) {
        TaskScaffold(onClose = close) { padding -> PageLoading(Modifier.padding(padding)) }
        return
    }

    val state by app.recap.weeklyRecap[goalId].collectShown()
    val scope = rememberCoroutineScope()

    when (val shown = state) {
        is LoadState.Loaded -> {
            TrackShown(AnalyticsEvent.LogbookViewed)
            Logbook(shown.value, name, onClose = close, onStart = { navigator.showRoot(AppTab.Today) })
        }

        is LoadState.Failed, LoadState.Empty -> {
            TaskScaffold(onClose = close) { padding ->
                LoadFailedMessage(
                    onRetry = { scope.launch { app.recap.weeklyRecap[goalId].refresh() } },
                    modifier = Modifier.padding(padding),
                )
            }
        }

        LoadState.Idle, LoadState.Loading -> {
            TaskScaffold(onClose = close) { padding -> PageLoading(Modifier.padding(padding)) }
        }
    }
}

/** One screen, read top to bottom; a quiet week or one before the first Sunday has no numbers to show. */
@Composable
internal fun Logbook(
    recap: WeeklyRecap,
    learnerName: String?,
    onClose: () -> Unit,
    onStart: () -> Unit,
) {
    val studied = recap.ready && recap.week.daysStudied.isNotEmpty()
    val scroll = rememberScrollState()
    var span by remember { mutableStateOf<PageSpan?>(null) }

    ResultScreen {
        BoxWithConstraints(Modifier.onPageSpan { span = it }) {
            val pages = spreadFold(maxWidth, span) != null

            TaskScaffold(
                onClose = onClose,
                bottomBar = {
                    TaskActionBar {
                        TaskActions { main -> Button(onClick = onStart, modifier = main) { Text(stringResource(R.string.recap_done)) } }
                    }
                },
            ) { padding ->
                if (pages) {
                    ResultPages(
                        modifier = Modifier.padding(padding),
                        withMoment = false,
                        columnModifier = Modifier.taskColumn(),
                        done = { WeekSummary(recap, learnerName, studied) },
                        next = { if (studied) WeekRows(recap) },
                    )
                } else {
                    Box(Modifier.fillMaxSize().padding(padding).verticalScroll(scroll), contentAlignment = Alignment.TopCenter) {
                        Column(Modifier.taskColumn().padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            WeekSummary(recap, learnerName, studied)
                            if (studied) WeekRows(recap)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WeekSummary(
    recap: WeeklyRecap,
    learnerName: String?,
    studied: Boolean,
) {
    val locale = currentLocale()

    WeekRings(recap)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Eyebrow(stringResource(R.string.recap_weekly_summary, weekRange(recap)))
        Text(
            text =
                when {
                    !studied && recap.ready -> stringResource(R.string.recap_quiet_week)
                    !studied -> stringResource(R.string.recap_first_summary)
                    learnerName != null -> stringResource(R.string.recap_what_a_week_name, learnerName)
                    else -> stringResource(R.string.recap_what_a_week)
                },
            modifier = Modifier.pageTitle(),
            style = MaterialTheme.typography.headlineMedium,
        )
        val line =
            when {
                studied -> goodNews(recap)
                recap.ready -> stringResource(R.string.recap_fresh_week)
                else -> null
            }
        if (line != null) Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
    }
    if (studied) {
        StatTiles(
            columns = 2,
            tiles =
                listOf(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.recap_time),
                            value = formatMinutes(recap.week.minutes.toInt(), locale),
                            modifier = modifier,
                            icon = tileIcon(R.drawable.ic_schedule),
                        )
                    },
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.recap_questions),
                            value = formatNumber(recap.week.questions.toDouble(), locale),
                            modifier = modifier,
                            icon = tileIcon(R.drawable.ic_checklist),
                        )
                    },
                ),
        )
    }
}

@Composable
private fun weekRange(recap: WeeklyRecap): String {
    val locale = currentLocale()
    val formatter =
        android.icu.text.DateIntervalFormat
            .getInstance("MMMd", locale)
    val start = recap.weekStart.toJavaLocalDate()
    val end = recap.weekEnd.toJavaLocalDate()
    val utc = android.icu.util.TimeZone.GMT_ZONE
    formatter.timeZone = utc
    val from = java.util.Date(start.toEpochDay() * MILLIS_PER_DAY)
    val to = java.util.Date(end.toEpochDay() * MILLIS_PER_DAY)
    return formatter.format(android.icu.util.DateInterval(from.time, to.time))
}

@Composable
private fun WeekRings(recap: WeeklyRecap) {
    val studied = recap.week.daysStudied.toSet()
    val locale = currentLocale()
    val description = pluralStringResource(R.plurals.recap_days_studied, studied.size, studied.size)

    Row(
        Modifier.widthIn(max = 320.dp).fillMaxWidth().clearAndSetSemantics {
            contentDescription = description
        },
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        repeat(DAYS_PER_WEEK) { offset ->
            val day = recap.weekStart.plus(DatePeriod(days = offset))
            val isStudied = day in studied
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                GoalRing(if (isStudied) 1f else 0f) { if (isStudied) DoneMark() }
                Text(
                    text = weekdayNames(locale).narrow.getValue(day.toJavaLocalDate().dayOfWeek),
                    color = if (isStudied) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

/** Only good news is said: a finished phase first, then a gain; a quieter week starts over. */
@Composable
private fun goodNews(recap: WeeklyRecap): String? {
    val minutes = recap.comparison.minutes.toInt()
    val questions = recap.comparison.questions.toInt()
    val finished = recap.phasesFinished.firstOrNull()

    return when {
        finished != null -> stringResource(R.string.recap_phase_finished, finished.name)
        minutes > 0 -> stringResource(R.string.recap_more_time, formatMinutes(minutes, currentLocale()))
        questions > 0 -> pluralStringResource(R.plurals.recap_more_questions, questions, questions)
        else -> null
    }
}

private fun tileIcon(id: Int): @Composable (Modifier) -> Unit =
    { modifier -> Icon(painterResource(id), contentDescription = null, modifier = modifier) }

/** A row with nothing to say isn't drawn, so a light week is a short list. */
@Composable
private fun WeekRows(recap: WeeklyRecap) {
    val locale = currentLocale()
    val ate = recap.buddyAte
    val badges = recap.badges.size.toLong()

    Column {
        CountRow({ KindMark(LearnKind.Lesson) }, stringResource(R.string.recap_new_topics), ate.newIdeas)
        CountRow({ KindMark(LearnKind.Review) }, stringResource(R.string.recap_reviews_done), ate.reviews)
        CountRow({ KindMark(LearnKind.Mistakes) }, stringResource(R.string.recap_mistakes_fixed), ate.fixes)
        CountRow(
            { RowIcon(R.drawable.ic_search_check) },
            pluralStringResource(R.plurals.recap_trap_hunter_badges, badges.toInt()),
            badges,
        )
        recap.turnaround?.let { turnaround ->
            NameRow(
                { RowIcon(R.drawable.ic_trending_up) },
                stringResource(R.string.recap_most_improved),
                stringResource(
                    R.string.recap_most_improved_value,
                    turnaround.name,
                    formatPercent(turnaround.from, locale),
                    formatPercent(turnaround.to, locale),
                ),
            )
        }
        recap.nextFocus?.let { NameRow({ RowIcon(R.drawable.ic_arrow_forward) }, stringResource(R.string.recap_up_next), it.title) }
    }
}

@Composable
private fun RowIcon(id: Int) {
    Icon(painterResource(id), contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun WeekRow(
    icon: @Composable () -> Unit,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}.padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) { icon() }
        content()
    }
}

@Composable
private fun CountRow(
    icon: @Composable () -> Unit,
    label: String,
    value: Long,
) {
    if (value == 0L) return

    WeekRow(icon) {
        Text(label, modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
        Text(
            formatNumber(value.toDouble(), currentLocale()),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
        )
    }
}

@Composable
private fun NameRow(
    icon: @Composable () -> Unit,
    label: String,
    value: String,
) {
    WeekRow(icon) {
        Text(label, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
        Text(
            value,
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.End,
            style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
        )
    }
}

private const val DAYS_PER_WEEK = 7
private const val MILLIS_PER_DAY = 86_400_000L
