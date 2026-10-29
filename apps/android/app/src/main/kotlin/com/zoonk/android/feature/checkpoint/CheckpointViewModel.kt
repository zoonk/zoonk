package com.zoonk.android.feature.checkpoint

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.TranscriptLine
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.ItemSetListeningTranscriptInner
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.min

data class Duel(
    val read: CheckpointRead,
    val state: DuelState,
)

/** Plays a checkpoint (main's `useCheckpointDuel`); the duel keeps the questions it started with. */
class CheckpointViewModel(
    private val blockId: UUID,
    private val store: CheckpointStore,
    private val now: () -> Long = SystemClock::elapsedRealtime,
) : ViewModel() {
    private val mutableDuel = MutableStateFlow<Duel?>(null)
    val duel: StateFlow<Duel?> = mutableDuel.asStateFlow()

    private val closing = MutableStateFlow(false)
    val closed: StateFlow<Boolean> = closing.asStateFlow()
    private var closeWhenFinished = false

    val checkpoint get() = store.checkpoints[blockId]

    private var shownAt = now()
    private var sent: Answer? = null
    private var finishing: Job? = null

    fun begin(checkpoint: Checkpoint) {
        if (mutableDuel.value != null) return
        mutableDuel.value = Duel(checkpoint.read(), DuelState.of(checkpoint))
        shownAt = now()
    }

    fun confirm(answer: Answer) {
        val current = mutableDuel.value ?: return
        val question = current.state.current(current.read) ?: return
        if (current.state.pending || current.state.feedback != null) return
        update { it.copy(pending = true, error = null) }
        sent = answer

        viewModelScope.launch {
            val duration = min(MAX_ANSWER_MS, now() - shownAt)
            when (val result = store.answer(current.read.checkpoint, question.itemId, answer, duration)) {
                is MutationResult.Done -> {
                    sent = null
                    val feedback = result.value
                    val transcript = question.set?.id?.let { set -> feedback.transcript?.let { set to it.lines() } }
                    update { it.answered(question.itemId, answer, feedback.isCorrect, feedback.reinforcementLessons?.toInt(), transcript) }
                }

                is MutationResult.Failed -> {
                    update { it.copy(pending = false, error = DuelError.Answer) }
                    if (result.code in STALE) reread()
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

    fun next() {
        val current = mutableDuel.value ?: return
        if (current.state.feedback == null && current.state.current(current.read) != null) return
        update { it.copy(feedback = null) }
        shownAt = now()
        if (current.state.score(current.read).done) finish()
    }

    fun retry() {
        val state = mutableDuel.value?.state ?: return
        if (state.error == DuelError.Finish) finish() else sent?.let(::confirm)
    }

    private fun finish() {
        if (finishing?.isActive == true) return
        val checkpoint = mutableDuel.value?.read?.checkpoint ?: return
        update { it.copy(pending = true, error = null) }
        finishing =
            viewModelScope.launch {
                when (val result = store.finish(checkpoint)) {
                    is MutationResult.Done -> {
                        update { it.finished(result.value) }
                    }

                    is MutationResult.Failed -> {
                        update { it.copy(pending = false, error = DuelError.Finish) }
                    }

                    MutationResult.Obsolete -> {}
                }
                if (closeWhenFinished) closing.value = true
            }
    }

    /** Leaving while the duel finishes waits for it: leaving the screen would cancel the save. */
    fun close() {
        if (finishing?.isActive == true) closeWhenFinished = true else closing.value = true
    }

    /** The answer was saved elsewhere or the duel ended: start again from what the server has. */
    private fun reread() {
        viewModelScope.launch {
            checkpoint.refresh()
            val loaded = (checkpoint.state.value as? LoadState.Loaded)?.value ?: return@launch
            sent = null
            mutableDuel.value = Duel(loaded.read(), DuelState.of(loaded))
            shownAt = now()
        }
    }

    private fun update(change: (DuelState) -> DuelState) = mutableDuel.update { it?.copy(state = change(it.state)) }

    private companion object {
        const val MAX_ANSWER_MS = 3_600_000L
        val STALE = setOf("ALREADY_ANSWERED", "BLOCK_NOT_ACTIVE")
    }
}

private fun List<ItemSetListeningTranscriptInner>.lines(): List<TranscriptLine> =
    map {
        it.recode<ItemSetListeningTranscriptInner, TranscriptLine>()
    }
