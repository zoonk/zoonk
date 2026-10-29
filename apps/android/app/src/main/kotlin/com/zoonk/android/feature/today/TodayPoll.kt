package com.zoonk.android.feature.today

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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

/**
 * Reads [read] again every 5 seconds while [active] and the app is in the foreground, as main does
 * while lessons are written. True once it gave up: 3 failed reads in a row, or 10 minutes.
 */
@Composable
internal fun PollWhile(
    active: Boolean,
    read: Resource<*>,
): Boolean {
    var stalled by remember { mutableStateOf(false) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(active, read) {
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

    return active && stalled
}

private val INTERVAL = 5.seconds
private val TIMEOUT = 10.minutes
private const val MAX_FAILURES = 3
