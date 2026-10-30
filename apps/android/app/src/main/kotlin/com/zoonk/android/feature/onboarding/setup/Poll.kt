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
import com.zoonk.android.data.StepState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.api.ApiJson
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.nullable
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
    val restart: () -> Unit,
)

/**
 * Asks every few seconds while the plan isn't [ready], then once for each new [query], keeping each
 * answer so going back to an earlier choice needs no new one. After the first answer, days tapped in
 * a row ask once; [paused] stops asking again a plan whose run stopped, and [planMade] asks again at
 * once when the run says the plan exists. The first and last answers,
 * the ask out and a failed ask outlive the screen's recreation, as the choices they decide do. The
 * latest enabled [query] goes once the ask out comes back, whose answer still counts, so abandoned
 * ones are never sent; an ask unanswered for 45 seconds fails while it's still out. [resources] must
 * send one ask at a time themselves, since a setup left and opened again doesn't know what's out.
 */
@Composable
internal fun <Q : Any, T : Any> rememberPlanAnswer(
    resources: KeyedResources<Q, T>,
    query: Q,
    enabled: Boolean,
    paused: Boolean,
    planMade: Boolean,
    querySerializer: KSerializer<Q>,
    serializer: KSerializer<T>,
    ready: (T) -> Boolean,
): PlanAnswer<T> {
    var first by rememberSaveable(stateSaver = jsonSaver(serializer.nullable)) { mutableStateOf<T?>(null) }
    var last by rememberSaveable(stateSaver = jsonSaver(serializer.nullable)) { mutableStateOf<T?>(null) }
    var settled by rememberSaveable(stateSaver = jsonSaver(querySerializer)) { mutableStateOf(query) }
    var missed by rememberSaveable(query) { mutableStateOf(false) }
    val came = { value: T ->
        last = value
        if (first == null && ready(value)) first = value
    }
    val asking = enabled && settled == query
    LaunchedEffect(query, enabled) {
        if (!enabled || settled == query) return@LaunchedEffect
        if (last != null) delay(SETTLE)
        val out = resources[settled]
        combine(out.state, out.isRefreshing) { state, refreshing -> state == LoadState.Loading || refreshing }.first { !it }
        out.state.value.value
            ?.let(came)
        settled = query
    }
    val state = if (asking) resources[query].collectShown().value else null
    val answer = (state as? LoadState.Loaded)?.value
    LaunchedEffect(answer) { answer?.let(came) }
    val active = asking && answer?.let(ready) != true && !(paused && answer != null)
    val poll = rememberPoll(active, key = query) { resources[query].refreshed() }
    LaunchedEffect(planMade) { if (planMade && active) poll.restart() }
    LaunchedEffect(query, enabled, answer == null, poll.round) {
        if (!enabled || answer != null) return@LaunchedEffect
        delay(ANSWER_TIMEOUT)
        missed = true
    }
    val status = if (missed && answer == null) PollStatus.Failed else poll.status(active)
    val restart = {
        missed = false
        poll.restart()
    }
    return PlanAnswer(answer, first, answer ?: last, poll, status, restart)
}

private fun <T> jsonSaver(serializer: KSerializer<T>) =
    Saver<T, String>(
        save = { ApiJson.encodeToString(serializer, it) },
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

/** The run's plan exists, so what waits on it asks now instead of at its next check. */
internal val GenerationRun.planMade get() = steps["createPlan"] == StepState.Completed

/** Polling that stopped reads as a lost connection, whose Try again polls again. */
internal fun GenerationRun.withPoll(poll: Poll): GenerationRun =
    if (poll.stopped) copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection) else this

private val POLL_INTERVAL = 3.seconds
private val SETTLE = 300.milliseconds
private val ANSWER_TIMEOUT = 45.seconds
private val POLL_TIMEOUT = 10.minutes
private const val MAX_FAILURES = 3
