package com.zoonk.android.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.res.stringResource
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import kotlinx.coroutines.launch

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

    RouteFrame(route, navigator) { padding ->
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
