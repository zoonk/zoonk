package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.OutlinedButton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

/** A session block's Continue and Stop for today (main's `useStudyNavigation`). */
interface SessionSteps {
    /** The session's next step, its summary once nothing is left, or Today when the day is over. */
    suspend fun continueSession(sessionId: UUID): MutationResult<AppRoute>

    /** The stopped session's summary. */
    suspend fun stop(sessionId: UUID): MutationResult<AppRoute>
}

enum class SessionStep { Continue, Stop }

/** A block's end while [pending] saves, after [failed], or [leaving] for the route it opened. */
@Immutable
data class SessionMove(
    val pending: SessionStep? = null,
    val failed: SessionStep? = null,
    val leaving: AppRoute? = null,
) {
    val busy: Boolean get() = pending != null || leaving != null
}

class SessionMover(
    private val steps: SessionSteps,
    private val sessionId: UUID,
    private val scope: CoroutineScope,
) {
    private val mutableMove = MutableStateFlow(SessionMove())
    val move: StateFlow<SessionMove> = mutableMove.asStateFlow()

    fun continueSession() = move(SessionStep.Continue) { steps.continueSession(sessionId) }

    fun stop() = move(SessionStep.Stop) { steps.stop(sessionId) }

    private fun move(
        step: SessionStep,
        write: suspend () -> MutationResult<AppRoute>,
    ) {
        if (mutableMove.value.busy) return

        mutableMove.value = SessionMove(pending = step)
        scope.launch {
            mutableMove.value =
                when (val result = write()) {
                    is MutationResult.Done -> SessionMove(leaving = result.value)
                    is MutationResult.Failed -> SessionMove(failed = step)
                    MutationResult.Obsolete -> SessionMove()
                }
        }
    }
}

fun AppNavigator.leaveTaskFor(route: AppRoute) {
    closeTask()
    if (route == AppRoute.Today) showRoot(AppTab.Today) else open(route)
}

/**
 * Main's `MomentActions`: Stop for today sits above Continue on narrower windows, so a quick second
 * tap after the last answer's Continue never stops the session. A finished session's Continue
 * opens its summary.
 */
@Composable
fun SessionEndActions(
    move: SessionMove,
    completed: Boolean,
    canStop: Boolean,
    onStop: () -> Unit,
    onContinue: () -> Unit,
) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val buttons: @Composable (Modifier) -> Unit = { width ->
        if (canStop && !completed) {
            OutlinedButton(onClick = onStop, enabled = !move.busy, modifier = width) {
                Text(stringResource(R.string.player_stop_for_today))
            }
        }
        Button(onClick = onContinue, enabled = !move.busy, modifier = width) {
            Text(stringResource(if (completed) R.string.player_see_todays_summary else R.string.player_action_continue))
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        move.failed?.let { failed ->
            Text(
                stringResource(if (failed == SessionStep.Stop) R.string.player_stop_failed else R.string.player_next_step_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (wide) TaskActions { width -> buttons(width) } else buttons(Modifier.fillMaxWidth())
    }
}
