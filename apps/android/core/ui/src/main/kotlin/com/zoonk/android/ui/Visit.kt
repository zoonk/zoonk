package com.zoonk.android.ui

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import com.zoonk.android.data.VisitOutcomes

/**
 * Runs [onOutcome] for each outcome owed to this visit, with this screen's navigator or sheet, and ends the
 * visit when the screen goes for real; a recreation keeps it.
 */
@Composable
fun <T> CollectForVisit(
    outcomes: VisitOutcomes<T>,
    onOutcome: (T) -> Unit,
) {
    val current by rememberUpdatedState(onOutcome)
    LaunchedEffect(outcomes) { outcomes.outcomes.collect { current(it) } }
    OnVisitEnd(outcomes) { outcomes.endVisit() }
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
