package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.api.ApiJson
import kotlinx.coroutines.delay
import kotlinx.serialization.KSerializer
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

@Stable
internal class Poll {
    var stopped by mutableStateOf(false)
        internal set

    internal var round by mutableIntStateOf(0)
        private set

    internal var readsAtOnce = false

    fun restart() {
        stopped = false
        readsAtOnce = true
        round++
    }
}

internal enum class PollStatus { Idle, Polling, Failed }

/**
 * [read] every few seconds after the screen's own load while [active] and the screen is on, until
 * three reads in a row fail or ten minutes pass, which stops it until a new [key] or [Poll.restart],
 * whose Try again reads at once.
 */
@Composable
internal fun rememberPoll(
    active: Boolean,
    key: Any? = null,
    read: suspend () -> Boolean,
): Poll {
    val poll = remember { Poll() }
    val currentRead by rememberUpdatedState(read)
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(active, key, poll.round, lifecycle) {
        poll.stopped = false
        if (!active) return@LaunchedEffect
        val startedAt = TimeSource.Monotonic.markNow()
        var failures = 0
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (!poll.stopped) {
                if (poll.readsAtOnce) poll.readsAtOnce = false else delay(POLL_INTERVAL)
                failures = if (currentRead()) 0 else failures + 1
                if (failures >= MAX_FAILURES || startedAt.elapsedNow() >= POLL_TIMEOUT) poll.stopped = true
            }
        }
    }

    return poll
}

internal fun Poll.status(active: Boolean) =
    when {
        !active -> PollStatus.Idle
        stopped -> PollStatus.Failed
        else -> PollStatus.Polling
    }

/** The plan's answer for what's asked now (null while it's on its way), the first ready one and the last that came. */
internal class PlanAnswer<T>(
    val answer: T?,
    val first: T?,
    val last: T?,
    val poll: Poll,
    val status: PollStatus,
)

/**
 * Asks every few seconds while the plan isn't [ready], then once for each new [query], keeping each
 * answer so going back to an earlier choice needs no new one. After the first answer, days tapped in
 * a row ask once; [paused] stops asking again a plan whose run stopped. The first answer outlives the
 * screen's recreation, as the choices it decides do.
 */
@Composable
internal fun <Q : Any, T : Any> rememberPlanAnswer(
    resources: KeyedResources<Q, T>,
    query: Q,
    enabled: Boolean,
    paused: Boolean,
    serializer: KSerializer<T>,
    ready: (T) -> Boolean,
): PlanAnswer<T> {
    var first by rememberSaveable(stateSaver = jsonSaver(serializer)) { mutableStateOf<T?>(null) }
    var last by remember { mutableStateOf<T?>(null) }
    var settled by remember { mutableStateOf(query) }
    LaunchedEffect(query) {
        if (last != null) delay(SETTLE)
        settled = query
    }
    val asked = if (last == null) query else settled
    val state = if (enabled) resources[asked].collectShown().value else null
    val answer = (state as? LoadState.Loaded)?.value?.takeIf { asked == query }
    LaunchedEffect(answer) {
        answer ?: return@LaunchedEffect
        last = answer
        if (first == null && ready(answer)) first = answer
    }
    val active = enabled && answer?.let(ready) != true && !(paused && answer != null)
    val poll = rememberPoll(active, key = query) { resources[query].refreshed() }
    return PlanAnswer(answer, first, answer ?: last, poll, poll.status(active))
}

private fun <T : Any> jsonSaver(serializer: KSerializer<T>) =
    Saver<T?, String>(
        save = { value -> value?.let { ApiJson.encodeToString(serializer, it) } },
        restore = { ApiJson.decodeFromString(serializer, it) },
    )

/** True when the read came back with a value; a stored failure (a 404 too) counts as failed. */
internal suspend fun Resource<*>.refreshed(): Boolean {
    val before = revision
    refresh()
    return revision != before && state.value !is LoadState.Failed
}

/** A run that failed or never started waits for its Try again; a lost connection doesn't. */
internal val GenerationRun.isStopped get() = status == GenerationRun.Status.Failed && failure != GenerationFailure.Connection

/** Polling that stopped reads as a lost connection, whose Try again polls again. */
internal fun GenerationRun.withPoll(poll: Poll): GenerationRun =
    if (poll.stopped) copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection) else this

private val POLL_INTERVAL = 3.seconds
private val SETTLE = 300.milliseconds
private val POLL_TIMEOUT = 10.minutes
private const val MAX_FAILURES = 3
