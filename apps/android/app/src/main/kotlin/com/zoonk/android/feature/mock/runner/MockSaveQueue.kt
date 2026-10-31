package com.zoonk.android.feature.mock.runner

import com.zoonk.android.feature.questions.Answer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlin.math.min
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Everything about one question on the answer sheet: the answer (null is blank), the time on it and the flag. */
@Serializable
data class MockDraft(
    val itemId: String,
    val answer: Answer? = null,
    val durationMs: Long = 0,
    val flagged: Boolean = false,
)

/** `Refused` holds until a later answer is stored. */
enum class DraftSaveStatus { Saved, Saving, Retrying, Refused }

/** What sending one answer came to; [Stop] when the session it belongs to ended. */
enum class SendResult { Stored, Refused, Unreachable, Stop }

/**
 * Main's `createDraftSaveQueue`: sends answers in order, so an older answer to a question never
 * lands after a newer one, and retries one that couldn't reach the server, with a growing wait,
 * before what follows. A newer answer to a question still waiting replaces the older one, since
 * each holds everything about its question. [onPendingChange] runs whenever [pending] changes, so
 * the device can keep it. Call it on the main thread.
 */
class MockSaveQueue(
    private val scope: CoroutineScope,
    private val send: suspend (MockDraft) -> SendResult,
    private val onPendingChange: () -> Unit,
    private val retryDelay: (attempt: Int) -> Duration = ::backoff,
) {
    private val waiting = mutableListOf<MockDraft>()
    private var sending: MockDraft? = null
    private var attempt = 0
    private var refused = false
    private var retry: Job? = null
    private var stopped = false
    private val state = MutableStateFlow(DraftSaveStatus.Saved)

    val status: StateFlow<DraftSaveStatus> = state.asStateFlow()

    val isBusy: Boolean get() = sending != null || waiting.isNotEmpty()

    /** The newest answer to each question not stored yet, the one going out included. */
    val pending: List<MockDraft>
        get() = (listOfNotNull(sending) + waiting).associateBy(MockDraft::itemId).values.toList()

    fun add(draft: MockDraft) {
        if (stopped) return
        val index = waiting.indexOfFirst { it.itemId == draft.itemId }
        if (index == -1) waiting += draft else waiting[index] = draft
        onPendingChange()
        sendNext()
    }

    /** Returns once every answer given so far is stored or refused, or the session ended. */
    suspend fun idle() {
        if (!isBusy) return
        state.first { stopped || (it != DraftSaveStatus.Saving && it != DraftSaveStatus.Retrying) }
    }

    fun retryNow() {
        if (retry == null) return
        retry?.cancel()
        retry = null
        sendNext()
    }

    private fun sendNext() {
        if (sending != null || retry != null || stopped) return settle()
        val draft = waiting.removeFirstOrNull() ?: return settle()
        sending = draft
        settle()
        scope.launch {
            val result = send(draft)
            sending = null
            when (result) {
                SendResult.Unreachable -> {
                    // First in line again, unless a newer answer to its question replaced it meanwhile.
                    if (waiting.none { it.itemId == draft.itemId }) waiting.add(0, draft)
                    scheduleRetry()
                    settle()
                }

                SendResult.Stop -> {
                    stopped = true
                    waiting.clear()
                    settle()
                }

                SendResult.Stored, SendResult.Refused -> {
                    attempt = 0
                    refused = result == SendResult.Refused
                    onPendingChange()
                    sendNext()
                }
            }
        }
    }

    private fun scheduleRetry() {
        val wait = retryDelay(attempt)
        attempt += 1
        retry =
            scope.launch {
                delay(wait)
                retry = null
                sendNext()
            }
    }

    private fun settle() {
        state.value =
            when {
                retry != null -> DraftSaveStatus.Retrying
                isBusy -> DraftSaveStatus.Saving
                refused -> DraftSaveStatus.Refused
                else -> DraftSaveStatus.Saved
            }
    }
}

private fun backoff(attempt: Int): Duration = min(1 shl min(attempt, 4), LONGEST_RETRY_SECONDS).seconds

private const val LONGEST_RETRY_SECONDS = 15
