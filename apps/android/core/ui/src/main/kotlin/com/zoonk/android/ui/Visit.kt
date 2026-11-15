package com.zoonk.android.ui

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import com.zoonk.android.data.Visit
import com.zoonk.android.data.VisitOutcome

/** This screen is [visit]: it ends when the screen goes for real (another tab, a task over it, back), not when a recreation replaces it. */
@Composable
fun VisitOf(visit: Visit) = OnVisitEnd(visit) { visit.end() }

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
