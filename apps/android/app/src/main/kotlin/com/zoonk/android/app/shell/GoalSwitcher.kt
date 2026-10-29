package com.zoonk.android.app.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * The tab roots' top app bar title: the goal switcher (main's goal menu), listing the followed goals
 * and open quick explanations, New goal and Explore courses. Empty until the learner summary
 * exists to fill it, as main keeps neutral placeholders while the summary is unread.
 */
@Composable
fun GoalSwitcher(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val pending by app.goalSwitch.pending.collectAsStateWithLifecycle()
    val learner = summary.value ?: return
    val goals = learner.goals.filter(LearnerSummaryGoal::isListed)
    val followed = goals.filter { it.kind != LearnerSummaryGoal.Kind.EXPLAIN }
    val explanations = goals.filter { it.kind == LearnerSummaryGoal.Kind.EXPLAIN }
    val selectedId = pending ?: learner.activeGoalId ?: followed.firstOrNull()?.id
    val selected = followed.firstOrNull { it.id == selectedId } ?: followed.firstOrNull()
    val viewModel = viewModel { GoalSwitcherViewModel(app) }
    val snackbars = LocalSnackbarHostState.current
    val failedText = stringResource(R.string.goal_switcher_failed)
    LaunchedEffect(viewModel) { viewModel.failures.collect { snackbars.showSnackbar(failedText) } }
    var expanded by rememberSaveable { mutableStateOf(false) }

    if (selected == null && explanations.isEmpty()) {
        TextButton(onClick = { navigator.open(AppRoute.StartGoal()) }) {
            Icon(painterResource(R.drawable.ic_add), contentDescription = null, modifier = Modifier.size(18.dp))
            Text(text = stringResource(R.string.goal_switcher_start_goal), modifier = Modifier.padding(start = 8.dp))
        }
        return
    }

    val description =
        selected?.let { stringResource(R.string.goal_switcher_current_goal, it.title) } ?: stringResource(R.string.goal_switcher_start_goal)

    Box {
        // The button keeps its role and click action; only the words it reads are replaced.
        TextButton(onClick = { expanded = true }, modifier = Modifier.semantics { contentDescription = description }) {
            Row(Modifier.clearAndSetSemantics {}, verticalAlignment = Alignment.CenterVertically) {
                SwitcherTitle(selected)
            }
        }

        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.widthIn(max = MENU_WIDTH)) {
            MenuItems(selected, followed, explanations, onDismiss = { expanded = false }, navigator = navigator, viewModel = viewModel)
        }
    }
}

@Composable
private fun SwitcherTitle(selected: LearnerSummaryGoal?) {
    if (selected != null) {
        GoalMark(selected)
    } else {
        Icon(painterResource(R.drawable.ic_add), contentDescription = null, modifier = Modifier.size(18.dp))
    }
    Text(
        text = selected?.title ?: stringResource(R.string.goal_switcher_start_goal),
        modifier = Modifier.padding(horizontal = 8.dp).widthIn(max = TITLE_WIDTH),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurface,
    )
    Icon(
        painterResource(R.drawable.ic_expand_more),
        contentDescription = null,
        modifier = Modifier.size(18.dp),
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun MenuItems(
    selected: LearnerSummaryGoal?,
    followed: List<LearnerSummaryGoal>,
    explanations: List<LearnerSummaryGoal>,
    onDismiss: () -> Unit,
    navigator: AppNavigator,
    viewModel: GoalSwitcherViewModel,
) {
    if (selected != null) {
        MenuLabel(stringResource(R.string.goal_switcher_your_goals))
        followed.forEach { goal ->
            val isSelected = goal.id == selected.id
            DropdownMenuItem(
                text = {
                    Column {
                        Text(goal.title)
                        GoalLine(goal)
                    }
                },
                leadingIcon = { GoalMark(goal) },
                trailingIcon = if (isSelected) ({ Icon(painterResource(R.drawable.ic_check), contentDescription = null) }) else null,
                onClick = {
                    onDismiss()
                    if (!isSelected) viewModel.select(goal.id)
                },
                modifier = Modifier.semantics { this.selected = isSelected },
            )
        }
    }

    if (explanations.isNotEmpty()) {
        if (selected != null) HorizontalDivider()
        MenuLabel(stringResource(R.string.goal_switcher_quick_explanations))
        explanations.forEach { goal ->
            DropdownMenuItem(
                text = { Text(goal.title) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_lightbulb), contentDescription = null) },
                onClick = {
                    onDismiss()
                    navigator.open(AppRoute.Explain(goal.id.toString()))
                },
            )
        }
    }

    HorizontalDivider()
    DropdownMenuItem(
        text = { Text(stringResource(R.string.goal_switcher_new_goal)) },
        leadingIcon = { Icon(painterResource(R.drawable.ic_add), contentDescription = null) },
        onClick = {
            onDismiss()
            navigator.open(AppRoute.StartGoal())
        },
    )
    DropdownMenuItem(
        text = { Text(stringResource(R.string.goal_switcher_explore_courses)) },
        leadingIcon = { Icon(painterResource(R.drawable.ic_grid_view), contentDescription = null) },
        onClick = {
            onDismiss()
            navigator.open(AppRoute.Catalog())
        },
    )
}

class GoalSwitcherViewModel(
    private val app: AppContainer,
) : ViewModel() {
    private val failed = Channel<Unit>(Channel.CONFLATED)
    val failures = failed.receiveAsFlow()

    fun select(goalId: UUID) {
        val session = app.sessions.current
        viewModelScope.launch {
            val saved = app.goalSwitch.select(goalId, listOf(app.learnerSummary.summary, app.today.today), shows = app.today::shows)
            // A switch its session didn't outlive (sign-out, another account) isn't the next learner's to retry.
            if (!saved && app.sessions.current == session) failed.send(Unit)
        }
    }
}

/** An explanation read to the end leaves the switcher: search finds it again. */
private val LearnerSummaryGoal.isListed: Boolean
    get() =
        status != LearnerSummaryGoal.Status.ARCHIVED &&
            !(kind == LearnerSummaryGoal.Kind.EXPLAIN && status == LearnerSummaryGoal.Status.COMPLETED)

@Composable
private fun MenuLabel(text: String) {
    Text(
        text = text,
        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp).semantics { heading() },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium,
    )
}

@Composable
private fun GoalLine(goal: LearnerSummaryGoal) {
    val locale = currentLocale()
    val line =
        when (goal.status) {
            LearnerSummaryGoal.Status.COMPLETED -> {
                stringResource(R.string.goal_switcher_finished)
            }

            LearnerSummaryGoal.Status.PAUSED -> {
                stringResource(R.string.goal_switcher_paused)
            }

            else -> {
                val daily = stringResource(R.string.goal_switcher_daily, formatMinutes(goal.dailyMinutes.toInt(), locale))
                val days = goal.targetDate?.let { ChronoUnit.DAYS.between(LocalDate.now(), it.toJavaLocalDate()) }
                val left =
                    when {
                        days == null || days < 0 -> null
                        days == 0L -> stringResource(R.string.today_day_is_here)
                        else -> pluralStringResource(R.plurals.today_days_left, days.toInt(), days.toInt())
                    }
                listOfNotNull(daily, left).joinToString(" · ")
            }
        }

    Text(text = line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium.withTabularFigures())
}

/** The goal's first letter on a quiet tile (main's `GoalMark`). */
@Composable
private fun GoalMark(goal: LearnerSummaryGoal) {
    Surface(
        shape = MaterialTheme.shapes.extraSmall,
        color = MaterialTheme.colorScheme.surfaceContainerHighest,
        modifier = Modifier.size(20.dp).clearAndSetSemantics {},
    ) {
        Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text(
                text =
                    goal.title
                        .firstOrNull()
                        ?.uppercase()
                        .orEmpty(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

private val TITLE_WIDTH = 240.dp
private val MENU_WIDTH = 320.dp
