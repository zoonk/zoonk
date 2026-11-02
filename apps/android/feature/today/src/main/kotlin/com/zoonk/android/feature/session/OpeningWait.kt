package com.zoonk.android.feature.session

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.milliseconds

enum class WaitState { None, Slow, VerySlow }

/** A wait says something only once it's slow, and again once it's very slow. */
@Composable
fun rememberWaitState(pending: Boolean): WaitState {
    var state by remember { mutableStateOf(WaitState.None) }

    LaunchedEffect(pending) {
        state = WaitState.None
        if (!pending) return@LaunchedEffect
        delay(SLOW)
        state = WaitState.Slow
        delay(VERY_SLOW - SLOW)
        state = WaitState.VerySlow
    }

    return if (pending) state else WaitState.None
}

@Composable
fun OpeningWaitLine(
    wait: WaitState,
    modifier: Modifier = Modifier,
) {
    val text =
        when (wait) {
            WaitState.None -> return
            WaitState.Slow -> stringResource(R.string.session_opening_slow)
            WaitState.VerySlow -> stringResource(R.string.session_opening_very_slow)
        }

    Text(
        text = text,
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

private val SLOW = 1500.milliseconds
private val VERY_SLOW = 15_000.milliseconds
