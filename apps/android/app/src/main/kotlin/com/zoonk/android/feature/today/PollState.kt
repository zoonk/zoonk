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

/** [stalled] once polling gave up; [restart] starts it over, as Reconnect does. */
internal class PollState(
    val stalled: Boolean,
    val restart: () -> Unit,
)

/**
 * Reads [read] again every 5 seconds while [active] and the app is in the foreground, as main does
 * while lessons are written. It gives up after 3 failed reads in a row, or once a learner's ask for
 * lessons could have lapsed with nothing new shown: the server stops waiting on an ask after 15
 * minutes, so the read one interval later shows the day without it. A read that shows something new
 * waits that long again. A new [context] (another goal or day) starts over.
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

        var failures = 0
        var unchanged = 0

        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (!stalled) {
                delay(INTERVAL)
                val revision = read.revision
                val shown = read.state.value
                read.refresh()
                // A refresh that fails keeps what's shown, so an unchanged revision is how a failure shows.
                failures = if (read.revision == revision) failures + 1 else 0
                unchanged = if (read.state.value == shown) unchanged + 1 else 0
                stalled = failures >= MAX_FAILURES || unchanged >= READS_UNTIL_ASK_LAPSES
            }
        }
    }

    return PollState(active && stalled) { round++ }
}

private val INTERVAL = 5.seconds

/** Main's `OUTLINE_STALE_AFTER_MS`. */
private val ASK_LAPSES_AFTER = 15.minutes
private val READS_UNTIL_ASK_LAPSES = (ASK_LAPSES_AFTER / INTERVAL).toInt() + 1
private const val MAX_FAILURES = 3
