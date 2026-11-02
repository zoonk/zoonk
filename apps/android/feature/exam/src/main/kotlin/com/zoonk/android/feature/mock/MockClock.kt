package com.zoonk.android.feature.mock

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Instant

/** The time now, read again every [tick] while the screen is started, and at once when it returns. */
@Composable
fun rememberNow(
    tick: Duration,
    clock: Clock = Clock.System,
): State<Instant> {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    return produceState(clock.now(), lifecycle, tick) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                value = clock.now()
                delay(tick)
            }
        }
    }
}
