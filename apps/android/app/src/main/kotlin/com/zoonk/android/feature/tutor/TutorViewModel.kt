package com.zoonk.android.feature.tutor

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.value
import com.zoonk.android.feature.memory.MemoryUndo
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.StudyMissionMoment
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.takeWhile
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random
import kotlin.time.TimeSource

@Immutable
data class TutorConversationState(
    val asking: Boolean = false,
    val answeringId: String? = null,
    val askFailure: TutorFailure? = null,
    val answerFailures: Map<String, TutorFailure> = emptyMap(),
    val memoryChanges: Map<String, List<TutorMemoryChange>> = emptyMap(),
    val memoryUndos: Map<String, MemoryUndo> = emptyMap(),
    val decidingChanges: Set<UUID> = emptySet(),
    val failedDecisions: Set<UUID> = emptySet(),
    val missionMoment: StudyMissionMoment? = null,
    val loadingEarlier: Boolean = false,
    val earlierFailed: Boolean = false,
    /** A question whose reply never came: sending again asks it once more, with the same request. */
    val unresolvedQuestion: String? = null,
    /** An answer streamed here links nothing until its saved, checked text arrives. */
    val streamed: Set<String> = emptySet(),
) {
    /** Nothing can be asked until it resets, so it takes the composer's place. */
    fun limit(turns: List<TutorTurn>): Limit? = askFailure?.helpLimit ?: turns.lastOrNull()?.let { answerFailures[it.id]?.helpLimit }

    /** Every earlier question needs its answer first; a failed one is retried first, as on main. */
    fun canAsk(turns: List<TutorTurn>): Boolean =
        !asking && answeringId == null && limit(turns) == null && turns.all { it.status == TutorTurn.Status.Completed }

    /** The answer the conversation follows from the server: one this screen isn't streaming. */
    fun remote(turns: List<TutorTurn>): String? =
        if (answeringId != null) {
            null
        } else {
            (turns.firstOrNull { it.status == TutorTurn.Status.Running } ?: turns.firstOrNull { it.status == TutorTurn.Status.Pending })?.id
        }
}

class TutorViewModel internal constructor(
    scope: TutorScope,
    private val store: TutorStore,
) : ViewModel() {
    /** The conversation's latest scope (the question now checked) is what its next question is about. */
    var scope: TutorScope by mutableStateOf(scope)
        internal set

    /** Main decides a conversation's plan changes for the learner's active goal unless its scope names one. */
    var activeGoalId: String? by mutableStateOf(null)
        internal set

    internal val goalId: String? get() = scope.goalId ?: activeGoalId

    val thread: Resource<TutorThread> = store.threads[scope.thread]

    val draft = TextFieldState()

    private val mutableState = MutableStateFlow(TutorConversationState())
    val state: StateFlow<TutorConversationState> = mutableState.asStateFlow()

    private var unresolved: PendingAsk? = null
    private val checking = mutableSetOf<String>()

    private val api get() = store.api
    private val cache get() = store.cache
    private val sessions get() = store.sessions
    private val turns get() =
        thread.state.value.value
            ?.turns

    fun send() {
        val question = draft.text.toString().trim()
        ask(question, suggestion = null)
    }

    /** A lesson's own suggestion goes by its id, so its shared answer is reused. */
    fun send(suggestion: TutorSuggestion) = ask(suggestion.label, suggestion.id)

    fun retryAnswer(id: String) {
        val turn = turns?.firstOrNull { it.id == id } ?: return
        val session = sessions.current ?: return
        val others = turns.orEmpty().any { it.id != id && it.isInProgress }
        if (state.value.asking || state.value.answeringId != null || others) return
        if (turn.status != TutorTurn.Status.Failed && turn.status != TutorTurn.Status.Pending) return
        viewModelScope.launch { streamAnswer(id, session) }
    }

    /** An answer still being written elsewhere: read it, and follow its stream if it's still running. */
    fun checkAgain(id: String) {
        val session = sessions.current ?: return
        if (state.value.answeringId != null || turns?.firstOrNull { it.id == id }?.status != TutorTurn.Status.Running) return
        if (!checking.add(id)) return
        viewModelScope.launch {
            try {
                val turn = read(id, session) ?: return@launch
                if (turn.status == TutorTurn.Status.Running) streamAnswer(id, session) else adopt(turn)
            } finally {
                checking -= id
            }
        }
    }

    fun undoMemory(turnId: String) {
        val changes = state.value.memoryChanges[turnId] ?: return
        if ((state.value.memoryUndos[turnId] ?: MemoryUndo.Offered) != MemoryUndo.Offered) return
        mutableState.update { it.copy(memoryUndos = it.memoryUndos + (turnId to MemoryUndo.Undoing)) }
        viewModelScope.launch {
            val undone = store.undoMemory(changes.map { it.shown.reference })
            mutableState.update { it.copy(memoryUndos = it.memoryUndos + (turnId to if (undone) MemoryUndo.Undone else MemoryUndo.Failed)) }
        }
    }

    fun decidePlanChange(
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
    ) {
        val goal = goalId ?: return
        if (changeId in state.value.decidingChanges) return
        mutableState.update { it.copy(decidingChanges = it.decidingChanges + changeId, failedDecisions = it.failedDecisions - changeId) }
        viewModelScope.launch {
            val result = store.decidePlanChange(UUID.fromString(goal), changeId, status)
            if (result is MutationResult.Done) answered(result.value)
            mutableState.update {
                it.copy(
                    decidingChanges = it.decidingChanges - changeId,
                    failedDecisions = if (result is MutationResult.Failed) it.failedDecisions + changeId else it.failedDecisions,
                )
            }
        }
    }

    fun loadEarlier() {
        val page = thread.state.value.value ?: return
        val cursor = page.nextCursor ?: return
        val session = sessions.current ?: return
        if (!page.hasMore || state.value.loadingEarlier) return
        val first = page.turns.firstOrNull()?.id
        mutableState.update { it.copy(loadingEarlier = true, earlierFailed = false) }
        viewModelScope.launch {
            try {
                val earlier = api.thread(scope.thread, cursor, session) ?: TutorThread.Empty
                if (sessions.current != session) return@launch
                thread.update { now ->
                    if (now.turns.firstOrNull()?.id !=
                        first
                    ) {
                        now
                    } else {
                        TutorThread(earlier.turns + now.turns, earlier.hasMore, earlier.nextCursor)
                    }
                }
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) sessions.expire(session)
                mutableState.update { it.copy(earlierFailed = true) }
            } finally {
                mutableState.update { it.copy(loadingEarlier = false) }
            }
        }
    }

    /**
     * Follows an answer written elsewhere (another device, before the app was closed) while the
     * conversation shows, backing off up to 8 reads in a minute, as main does.
     */
    suspend fun followRemote(id: String) {
        val session = sessions.current ?: return
        val started = TimeSource.Monotonic.markNow()
        var attempt = 0
        while (attempt < MAX_POLLS && started.elapsedNow().inWholeMilliseconds < MAX_POLLING_MILLIS) {
            delay(pollDelay(attempt))
            attempt++
            if (sessions.current != session) return
            val turn =
                try {
                    api.question(id, session)
                } catch (e: ApiException) {
                    if (e.error == ApiError.Network || e.error == ApiError.Unavailable) continue
                    if (e.error == ApiError.Unauthorized) sessions.expire(session)
                    fail(id, e.toTutorFailure())
                    return
                }
            if (sessions.current != session) return
            adopt(turn)
            if (!turn.isInProgress) return
        }
    }

    private fun ask(
        question: String,
        suggestion: String?,
    ) {
        val turns = turns ?: return
        val session = sessions.current ?: return
        val pending =
            unresolved?.takeIf { it.session == session } ?: PendingAsk(question, suggestion, UUID.randomUUID().toString(), scope, session)
        if (pending.question.isEmpty() || !state.value.canAsk(turns)) return
        unresolved = pending
        mutableState.update { it.copy(asking = true, askFailure = null, unresolvedQuestion = null) }

        viewModelScope.launch {
            val result =
                cache.mutate { session ->
                    api.ask(pending.scope, pending.question, pending.suggestion, pending.requestId, session) to session
                }
            mutableState.update { it.copy(asking = false) }

            when (result) {
                is MutationResult.Done -> {
                    val (asked, session) = result.value
                    unresolved = null
                    draft.clearText()
                    // Replacing cancels an older read still in flight, which would drop the new question.
                    thread.state.value.value?.let { page ->
                        thread.replace(page.copy(turns = page.turns.filterNot { it.id == asked.turn.id } + asked.turn))
                    }
                    mutableState.update { it.copy(missionMoment = asked.missionMoment) }
                    if (asked.missionMoment != null) cache.invalidate(setOf(DataDomain.UserSession))
                    if (asked.turn.status == TutorTurn.Status.Pending || asked.turn.status == TutorTurn.Status.Failed) {
                        streamAnswer(asked.turn.id, session)
                    }
                }

                is MutationResult.Failed -> {
                    if (result.status == CONFLICT) {
                        unresolved = null
                        thread.refresh()
                        return@launch
                    }
                    val failure = result.toTutorFailure()
                    // The question may have been saved: only then is it sent again with the same request.
                    if (failure != TutorFailure.Failed) unresolved = null
                    mutableState.update { it.copy(askFailure = failure, unresolvedQuestion = unresolved?.question) }
                }

                MutationResult.Obsolete -> {
                    unresolved = null
                }
            }
        }
    }

    private suspend fun streamAnswer(
        id: String,
        session: AuthenticatedSession,
    ) {
        if (state.value.answeringId != null) return
        mutableState.update { it.copy(answeringId = id, answerFailures = it.answerFailures - id, streamed = it.streamed + id) }
        update(id) { it.copy(status = TutorTurn.Status.Running) }
        var text = ""
        var saved = false

        try {
            api.answer(id, session).takeWhile { sessions.current == session }.collect { event ->
                when (event) {
                    is TutorAnswerEvent.Text -> {
                        text += event.delta
                        update(id) { it.copy(answer = text) }
                    }

                    is TutorAnswerEvent.SavedAnswer -> {
                        text = event.answer
                        update(id) { it.copy(answer = text) }
                        mutableState.update { it.copy(streamed = it.streamed - id) }
                    }

                    is TutorAnswerEvent.Proposed -> {
                        update(id) { it.copy(planChange = event.change) }
                    }

                    is TutorAnswerEvent.Replaced -> {
                        thread.update { page ->
                            page.copy(
                                turns =
                                    page.turns.map { turn ->
                                        val change = turn.planChange
                                        if (change?.status == PlanChange.Status.PROPOSED && change.id.toString() in event.ids) {
                                            turn.copy(planChange = change.copy(status = PlanChange.Status.REPLACED))
                                        } else {
                                            turn
                                        }
                                    },
                            )
                        }
                    }

                    is TutorAnswerEvent.Offered -> {
                        update(id) { it.copy(toolOffer = event.offer) }
                    }

                    is TutorAnswerEvent.Remembered -> {
                        mutableState.update { it.copy(memoryChanges = it.memoryChanges + (id to event.changes)) }
                        cache.invalidate(setOf(DataDomain.Memory))
                    }

                    TutorAnswerEvent.Finish -> {
                        saved = true
                        update(id) { it.copy(status = TutorTurn.Status.Completed) }
                        mutableState.update { it.copy(answeringId = null) }
                    }
                }
            }
            if (sessions.current != session) return
            if (!saved) update(id) { it.copy(status = TutorTurn.Status.Completed) }
        } catch (e: ApiException) {
            if (e.error == ApiError.Unauthorized) sessions.expire(session)
            if (!saved && sessions.current == session) reconcile(id, e.toTutorFailure(), session)
        } finally {
            mutableState.update { if (it.answeringId == id) it.copy(answeringId = null) else it }
        }
    }

    /**
     * Main's reconciliation: an applied or undone change moves the plan, so no earlier change can be
     * undone anymore. Replacing cancels an older read still in flight, which would bring the change back.
     */
    private fun answered(change: PlanChange) {
        val page = thread.state.value.value ?: return
        val moved = change.status == PlanChange.Status.APPLIED || change.status == PlanChange.Status.UNDONE
        val turns =
            page.turns.map { turn ->
                val shown = turn.planChange
                when {
                    shown?.id == change.id -> turn.copy(planChange = change)
                    moved && shown?.canUndo == true -> turn.copy(planChange = shown.copy(canUndo = false))
                    else -> turn
                }
            }
        thread.replace(page.copy(turns = turns))
    }

    /** A dropped stream may still have saved its answer: read it before calling it failed. */
    private suspend fun reconcile(
        id: String,
        reason: TutorFailure,
        session: AuthenticatedSession,
    ) {
        val turn =
            try {
                api.question(id, session)
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) {
                    sessions.expire(session)
                    return
                }
                null
            }
        if (sessions.current != session) return
        if (turn != null && turn.status != TutorTurn.Status.Pending) adopt(turn)
        if (turn == null || turn.status == TutorTurn.Status.Pending || turn.status == TutorTurn.Status.Failed) fail(id, reason)
    }

    private suspend fun read(
        id: String,
        session: AuthenticatedSession,
    ): TutorTurn? =
        try {
            api.question(id, session).takeIf { sessions.current == session }
        } catch (e: ApiException) {
            if (e.error == ApiError.Unauthorized) sessions.expire(session)
            if (e.error != ApiError.Network && e.error != ApiError.Unavailable) fail(id, e.toTutorFailure())
            null
        }

    private fun fail(
        id: String,
        reason: TutorFailure,
    ) {
        update(id) { it.copy(status = TutorTurn.Status.Failed) }
        mutableState.update { it.copy(answerFailures = it.answerFailures + (id to reason)) }
    }

    /** The server's own copy of a turn: its answer is the saved one, whose links were checked. */
    private fun adopt(turn: TutorTurn) {
        update(turn.id) { turn }
        mutableState.update { it.copy(streamed = it.streamed - turn.id) }
    }

    private fun update(
        id: String,
        change: (TutorTurn) -> TutorTurn,
    ) = thread.update { it.updating(id, change) }

    /** Sent again exactly as it was, by the session that asked it. */
    private class PendingAsk(
        val question: String,
        val suggestion: String?,
        val requestId: String,
        val scope: TutorScope,
        val session: AuthenticatedSession,
    )
}

/** A suggested question; a lesson's own carries its [id] so its shared answer is reused. */
@Immutable
data class TutorSuggestion(
    val label: String,
    val id: String? = null,
)

/** Main's backoff: 1 s doubling up to 5 s, each within 20% either way. */
internal fun pollDelay(
    attempt: Int,
    random: Double = Random.nextDouble(),
): Long {
    val base = min(INITIAL_POLL_MILLIS * 2.0.pow(attempt), MAX_POLL_MILLIS)
    return (base * (MIN_JITTER + random * JITTER_RANGE)).toLong()
}

private const val MAX_POLLS = 8
private const val MAX_POLLING_MILLIS = 60_000L
private const val INITIAL_POLL_MILLIS = 1_000.0
private const val MAX_POLL_MILLIS = 5_000.0
private const val MIN_JITTER = 0.8
private const val JITTER_RANGE = 0.4
