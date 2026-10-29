package com.zoonk.android.feature.recap

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.GoalRing
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.WeeklyRecap
import com.zoonk.api.models.WeeklyRecapTurnaround
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.plus
import kotlinx.datetime.toJavaLocalDate
import java.time.format.TextStyle

/** The week's recap as a few steps; nothing in it is written by a model. */
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
    // Leaving goes to the buddy, where the week is told; the last step starts today.
    val close = { navigator.showRoot(AppTab.Buddy) }

    if (goalId == null) {
        TaskScaffold(onClose = close) { padding -> Loading(padding) }
        return
    }

    val state by app.recap.weeklyRecap[goalId].collectShown()
    val scope = rememberCoroutineScope()

    when (val shown = state) {
        is LoadState.Loaded -> {
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
            TaskScaffold(onClose = close) { padding -> Loading(padding) }
        }
    }
}

@Composable
private fun Loading(padding: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

private enum class RecapStep { Week, Turnaround, Learned, Next }

@Composable
internal fun Logbook(
    recap: WeeklyRecap,
    learnerName: String?,
    onClose: () -> Unit,
    onStart: () -> Unit,
) {
    val steps =
        if (!recap.ready || recap.week.daysStudied.isEmpty()) {
            listOf(RecapStep.Week)
        } else {
            listOfNotNull(
                RecapStep.Week,
                RecapStep.Turnaround.takeIf { recap.turnaround != null },
                RecapStep.Learned.takeIf { recap.hasLearned },
                RecapStep.Next.takeIf { recap.nextFocus != null },
            )
        }
    var index by rememberSaveable { mutableIntStateOf(0) }
    val current = steps[index.coerceIn(steps.indices)]

    TaskScaffold(
        onClose = onClose,
        bottomBar = {
            StepPagerActions(
                steps.size,
                index,
                onIndexChange = { index = it },
            ) {
                Button(onClick = onStart) { Text(stringResource(R.string.recap_lets_go)) }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
            // A step changed by Continue or Back is announced, as main moves focus to its title.
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 560.dp)
                        .fillMaxWidth()
                        .padding(24.dp)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                when (current) {
                    RecapStep.Week -> {
                        if (recap.ready &&
                            recap.week.daysStudied.isNotEmpty()
                        ) {
                            WeekStep(recap, learnerName)
                        } else {
                            QuietWeekStep(recap)
                        }
                    }

                    RecapStep.Turnaround -> {
                        recap.turnaround?.let { TurnaroundStep(it) }
                    }

                    RecapStep.Learned -> {
                        LearnedStep(recap)
                    }

                    RecapStep.Next -> {
                        recap.nextFocus?.let { StepHeader(stringResource(R.string.recap_next_week), it.title) }
                    }
                }
            }
        }
    }
}

private val WeeklyRecap.hasLearned: Boolean
    get() = buddyAte.newIdeas + buddyAte.reviews + buddyAte.fixes + badges.size > 0

@Composable
private fun StepHeader(
    eyebrow: String?,
    title: String,
    detail: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (eyebrow != null) Text(eyebrow, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        if (detail != null) Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
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
                    text =
                        day
                            .toJavaLocalDate()
                            .dayOfWeek
                            .getDisplayName(TextStyle.NARROW_STANDALONE, locale)
                            .uppercase(locale),
                    color = if (isStudied) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

/** Only good news is compared; a quieter week starts over. */
@Composable
private fun gainLine(recap: WeeklyRecap): String? {
    val minutes = recap.comparison.minutes.toInt()
    val questions = recap.comparison.questions.toInt()

    return when {
        minutes > 0 -> stringResource(R.string.recap_more_time, formatMinutes(minutes, currentLocale()))
        questions > 0 -> pluralStringResource(R.plurals.recap_more_questions, questions, questions)
        else -> null
    }
}

@Composable
private fun WeekStep(
    recap: WeeklyRecap,
    learnerName: String?,
) {
    val locale = currentLocale()
    val finished = recap.phasesFinished.firstOrNull()

    WeekRings(recap)
    StepHeader(
        eyebrow =
            finished?.let { stringResource(R.string.recap_phase_done, formatNumber((it.phase + 1).toDouble(), locale), it.name) }
                ?: stringResource(R.string.recap_weekly_summary, weekRange(recap)),
        title = learnerName?.let { stringResource(R.string.recap_what_a_week_name, it) } ?: stringResource(R.string.recap_what_a_week),
        detail = gainLine(recap),
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        StatTile(
            R.drawable.ic_schedule,
            stringResource(R.string.recap_time),
            formatMinutes(recap.week.minutes.toInt(), locale),
            Modifier.weight(1f),
        )
        StatTile(
            R.drawable.ic_checklist,
            stringResource(R.string.recap_questions),
            formatNumber(recap.week.questions.toDouble(), locale),
            Modifier.weight(1f),
        )
    }
}

@Composable
private fun StatTile(
    icon: Int,
    label: String,
    value: String,
    modifier: Modifier,
) {
    OutlinedCard(modifier.semantics(mergeDescendants = true) {}) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painterResource(icon),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            }
            Readout(value)
        }
    }
}

@Composable
private fun QuietWeekStep(recap: WeeklyRecap) {
    WeekRings(recap)
    StepHeader(
        eyebrow = stringResource(R.string.recap_weekly_summary, weekRange(recap)),
        title = stringResource(if (recap.ready) R.string.recap_quiet_week else R.string.recap_first_summary),
        detail = stringResource(if (recap.ready) R.string.recap_fresh_week else R.string.recap_first_summary_detail),
    )
}

@Composable
private fun TurnaroundStep(turnaround: WeeklyRecapTurnaround) {
    val locale = currentLocale()
    val remembered = turnaround.rememberedOn.size
    val reason =
        when (turnaround.reason) {
            WeeklyRecapTurnaround.Reason.GOLD -> pluralStringResource(R.plurals.recap_mastered, remembered, turnaround.name, remembered)
            WeeklyRecapTurnaround.Reason.SOLID -> stringResource(R.string.recap_solid, turnaround.name)
            WeeklyRecapTurnaround.Reason.PRACTICE -> null
        }

    StepHeader(
        eyebrow = stringResource(R.string.recap_turnaround),
        title = turnaround.name,
        detail =
            stringResource(
                R.string.recap_turnaround_detail,
                formatPercent(turnaround.from, locale),
                formatPercent(turnaround.to, locale),
            ),
    )
    TurnaroundChart(turnaround)
    if (reason != null) Text(reason, style = MaterialTheme.typography.bodyLarge)
}

/** Right answers each day; a day without study leaves a gap in the line. */
@Composable
private fun TurnaroundChart(turnaround: WeeklyRecapTurnaround) {
    val locale = currentLocale()
    val description = stringResource(R.string.recap_turnaround_chart)
    val line = MaterialTheme.colorScheme.tertiary
    val axis = MaterialTheme.colorScheme.outlineVariant
    val points = turnaround.points

    Column(Modifier.fillMaxWidth().semantics { contentDescription = description }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Canvas(Modifier.fillMaxWidth().aspectRatio(CHART_RATIO)) {
            val pad = 14.dp.toPx()
            val count = points.size

            fun x(index: Int) = pad + index.toFloat() / (count - 1).coerceAtLeast(1) * (size.width - pad * 2)

            fun y(accuracy: Double) = (size.height - pad - accuracy * (size.height - pad * 2)).toFloat()

            drawLine(
                axis,
                androidx.compose.ui.geometry
                    .Offset(pad, size.height - pad),
                androidx.compose.ui.geometry.Offset(
                    size.width - pad,
                    size.height - pad,
                ),
                1.dp.toPx(),
            )
            val studied =
                points.mapIndexedNotNull {
                    index,
                    point,
                    ->
                    point.accuracy?.let {
                        androidx.compose.ui.geometry
                            .Offset(x(index), y(it))
                    }
                }
            studied.zipWithNext { from, to -> drawLine(line, from, to, 3.dp.toPx(), StrokeCap.Round) }
            studied.forEach { drawCircle(line, 4.5.dp.toPx(), it) }
            if (studied.size == 1) drawCircle(line, 4.5.dp.toPx(), studied.single(), style = Stroke(1.dp.toPx()))
        }
        Row(Modifier.fillMaxWidth().clearAndSetSemantics {}) {
            points.forEach { point ->
                Text(
                    text =
                        point.date
                            .toJavaLocalDate()
                            .dayOfWeek
                            .getDisplayName(TextStyle.NARROW_STANDALONE, locale)
                            .uppercase(locale),
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

@Composable
private fun LearnedStep(recap: WeeklyRecap) {
    val ate = recap.buddyAte

    Text(
        stringResource(R.string.recap_learned),
        modifier = Modifier.semantics { heading() },
        style = MaterialTheme.typography.headlineMedium,
    )
    Column {
        LearnedRow(LearnKind.Lesson, ate.newIdeas, R.string.recap_new_idea, R.string.recap_new_ideas)
        LearnedRow(LearnKind.Review, ate.reviews, R.string.recap_review, R.string.recap_reviews)
        LearnedRow(LearnKind.Mistakes, ate.fixes, R.string.recap_mistake_fixed, R.string.recap_mistakes_fixed)
        LearnedRow(null, recap.badges.size.toLong(), R.string.recap_trap_hunter_badge, R.string.recap_trap_hunter_badges)
    }
}

@Composable
private fun LearnedRow(
    kind: LearnKind?,
    value: Long,
    one: Int,
    other: Int,
) {
    if (value == 0L) return

    Row(
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}.padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            if (kind != null) {
                KindMark(kind)
            } else {
                Icon(
                    painterResource(R.drawable.ic_search_check),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Text(
            stringResource(
                if (value ==
                    1L
                ) {
                    one
                } else {
                    other
                },
            ),
            modifier = Modifier.weight(1f),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            formatNumber(value.toDouble(), currentLocale()),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
        )
    }
}

private const val DAYS_PER_WEEK = 7
private const val CHART_RATIO = 2.5f
private const val MILLIS_PER_DAY = 86_400_000L
