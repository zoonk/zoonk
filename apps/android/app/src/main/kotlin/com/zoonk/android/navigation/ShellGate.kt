package com.zoonk.android.navigation

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.scaffold.TaskScaffold
import kotlinx.coroutines.launch

/** Who the shell shows screens to, from the session and the learner summary. */
enum class LearnerAccess {
    /** Restoring the stored session: gated screens wait, so no gate flashes before it's read. */
    Restoring,
    Unavailable,
    Visitor,

    /** The stored session ended: log in again, since the plan is still there. */
    SessionEnded,

    /** Signed in, the summary not read yet: screens load as for a learner with a goal. */
    SignedIn,
    NoGoal,
    Learner,
}

/**
 * Every entry behind [ShellGate], so a screen can assume what its route requires and no lane
 * gates its own pages.
 */
fun gatedEntries(
    entryProvider: (NavKey) -> NavEntry<NavKey>,
    access: State<LearnerAccess>,
    app: AppContainer,
    navigator: AppNavigator,
): (NavKey) -> NavEntry<NavKey> =
    { key ->
        val entry = entryProvider(key)
        NavEntry(entry) { route: NavKey -> ShellGate(route as AppRoute, access.value, app, navigator) { entry.Content() } }
    }

@Composable
fun ShellGate(
    route: AppRoute,
    access: LearnerAccess,
    app: AppContainer,
    navigator: AppNavigator,
    content: @Composable () -> Unit,
) {
    val requirement = route.requirement
    val isOpen =
        requirement == Requirement.None ||
            access == LearnerAccess.SignedIn ||
            access == LearnerAccess.Learner ||
            (requirement == Requirement.Account && access == LearnerAccess.NoGoal)

    if (isOpen) {
        content()
        return
    }

    RouteFrame(route, app, navigator) { padding ->
        when (access) {
            LearnerAccess.Visitor, LearnerAccess.SessionEnded -> {
                SignInGate(ended = access == LearnerAccess.SessionEnded, navigator, padding)
            }

            LearnerAccess.Unavailable -> {
                val scope = rememberCoroutineScope()
                GateMessage(
                    icon = R.drawable.ic_warning,
                    title = stringResource(R.string.account_unavailable_title),
                    description = stringResource(R.string.account_unavailable_description),
                    padding = padding,
                ) {
                    Button(onClick = { scope.launch { app.sessions.retryRestore() } }) {
                        Text(stringResource(R.string.load_failed_try_again))
                    }
                }
            }

            LearnerAccess.NoGoal -> {
                StartGoalGate(navigator, padding)
            }

            LearnerAccess.Restoring, LearnerAccess.SignedIn, LearnerAccess.Learner -> {}
        }
    }
}

@Composable
internal fun RouteFrame(
    route: AppRoute,
    app: AppContainer,
    navigator: AppNavigator,
    content: @Composable (PaddingValues) -> Unit,
) {
    when (route.presentation) {
        is Presentation.Tab -> {
            TabRootScaffold(app, navigator, content = content)
        }

        Presentation.Task -> {
            TaskScaffold(onClose = navigator::closeTask, content = content)
        }

        else -> {
            PageScaffold(onBack = { navigator.back() }, content = content)
        }
    }
}

@Composable
private fun SignInGate(
    ended: Boolean,
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    GateMessage(
        icon = R.drawable.ic_lock,
        title = stringResource(if (ended) R.string.gate_session_ended_title else R.string.gate_sign_in_title),
        description =
            stringResource(if (ended) R.string.gate_session_ended_description else R.string.gate_sign_in_description),
        padding = padding,
    ) {
        Button(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.gate_log_in)) }
        OutlinedButton(onClick = { navigator.open(AppRoute.StartGoal()) }) {
            Text(stringResource(if (ended) R.string.gate_start_something_new else R.string.gate_start_free))
        }
    }
}

@Composable
private fun StartGoalGate(
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    GateMessage(
        icon = R.drawable.ic_target,
        title = stringResource(R.string.gate_start_goal_title),
        description = stringResource(R.string.gate_start_goal_description),
        padding = padding,
    ) {
        Button(onClick = { navigator.showRoot(AppTab.Today) }) { Text(stringResource(R.string.gate_start_goal)) }
    }
}

@Composable
private fun GateMessage(
    @DrawableRes icon: Int,
    title: String,
    description: String,
    padding: PaddingValues,
    actions: @Composable () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                actions()
            }
        }
    }
}
