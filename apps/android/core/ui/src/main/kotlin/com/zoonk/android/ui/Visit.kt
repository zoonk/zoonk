package com.zoonk.android.ui

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameNanos
import com.zoonk.android.data.Visit
import com.zoonk.android.data.VisitOutcome

/**
 * This place is [visit]'s asker: the visit ends when it goes for real (another tab, a task over it, back, its sheet
 * closed), not when a recreation replaces it. Once the recreated layout has drawn, an opening inside [visit] that it
 * no longer composes has ended.
 */
@Composable
fun VisitOf(visit: Visit) {
    val activity = LocalActivity.current
    DisposableEffect(visit) {
        visit.hold()
        onDispose { visit.release(ending = activity?.isChangingConfigurations != true) }
    }
    LaunchedEffect(visit) {
        withFrameNanos {}
        visit.endOpeningsLeftBehind()
    }
}

/** Acts on [outcome] with this screen's navigator or sheet once it's owed, then says so, so a recreation before then acts on it instead. */
@Composable
fun <T : Any> ActOn(
    outcome: VisitOutcome<T>,
    act: (T) -> Unit,
) {
    val owed = outcome.value
    val current by rememberUpdatedState(act)
    LaunchedEffect(owed) {
        owed ?: return@LaunchedEffect
        current(owed)
        outcome.acted(owed)
    }
}

/** Runs [onEnd] when this screen goes for real (another tab, a task over it, back), not when a recreation replaces it. */
@Composable
fun OnVisitEnd(
    vararg keys: Any?,
    onEnd: () -> Unit,
) {
    val activity = LocalActivity.current
    val current by rememberUpdatedState(onEnd)
    DisposableEffect(*keys) { onDispose { if (activity?.isChangingConfigurations != true) current() } }
}
