package com.zoonk.android.feature.today

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.zoonk.android.data.Resource
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

/** [stalled] once polling gave up; [restart] starts it over, as Reconnect does. */
internal class PollState(
    val stalled: Boolean,
    val restart: () -> Unit,
)

/**
 * Reads [read] again every 5 seconds while [active] and the app is in the foreground, as main does
 * while lessons are written, and gives up after 3 failed reads in a row or 10 minutes. A new
 * [context] (another goal or day) starts over.
 */
@Composable
internal fun pollWhile(
    active: Boolean,
    read: Resource<*>,
    context: Any,
): PollState {
    var stalled by remember(context) { mutableStateOf(false) }
    var round by remember(context) { mutableIntStateOf(0) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(active, read, context, round) {
        stalled = false
        if (!active) return@LaunchedEffect

        val started = TimeSource.Monotonic.markNow()
        var failures = 0

        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (!stalled) {
                delay(INTERVAL)
                val revision = read.revision
                read.refresh()
                // A refresh that fails keeps what's shown, so an unchanged revision is how a failure shows.
                failures = if (read.revision == revision) failures + 1 else 0
                stalled = failures >= MAX_FAILURES || started.elapsedNow() >= TIMEOUT
            }
        }
    }

    return PollState(active && stalled) { round++ }
}

private val INTERVAL = 5.seconds
private val TIMEOUT = 10.minutes
private const val MAX_FAILURES = 3
