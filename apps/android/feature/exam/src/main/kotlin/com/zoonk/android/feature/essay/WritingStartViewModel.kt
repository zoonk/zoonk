package com.zoonk.android.feature.essay

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.UUID

/** Before the question exists: it's being written, its writing failed, or the day's extra grades are used. */
sealed interface WritingStartState {
    data class Writing(
        val generationId: String,
    ) : WritingStartState

    data object Failed : WritingStartState

    data object LimitReached : WritingStartState

    /** The question is admitted: the essay reads now. */
    data object Ready : WritingStartState
}

/**
 * Asking again is always the learner's tap, or the run they started ending: a run that finishes
 * starts the block again, which admits the grading or answers with the next wait.
 */
class WritingStartViewModel(
    private val blockId: UUID,
    initial: WritingBefore,
    private val store: EssayStore,
    source: GenerationSource,
) : ViewModel() {
    private val mutableState =
        MutableStateFlow(
            when (initial) {
                is WritingBefore.Writing -> WritingStartState.Writing(initial.generationId)
                WritingBefore.Failed -> WritingStartState.Failed
                WritingBefore.LimitReached -> WritingStartState.LimitReached
            },
        )
    val state: StateFlow<WritingStartState> = mutableState.asStateFlow()

    private val mutableAsking = MutableStateFlow(false)
    val asking: StateFlow<Boolean> = mutableAsking.asStateFlow()

    private val follower = GenerationFollower(GenerationKind.WritingPrompt, viewModelScope, source, restart = { restart() })
    val run: StateFlow<GenerationRun> = follower.run

    private var waiting: Job? = null

    init {
        (initial as? WritingBefore.Writing)?.let { follow(it.generationId) }
    }

    /** Try again, after a start that failed. */
    fun retry() {
        viewModelScope.launch { ask() }
    }

    fun retryRun() = follower.retry()

    private fun follow(generationId: String) {
        follower.follow(generationId)
        waiting?.cancel()
        waiting =
            viewModelScope.launch {
                follower.run.first { it.status == GenerationRun.Status.Ready }
                ask()
            }
    }

    /** The run's own Try again starts the block again; a new run is followed in its place. */
    private suspend fun restart(): String? =
        when (val answer = start()) {
            is WritingStartAnswer.Writing -> answer.generationId
            null -> throw IllegalStateException("The question couldn't start")
            else -> settle(answer).let { null }
        }

    private suspend fun ask() {
        mutableAsking.value = true
        val answer = start()
        mutableAsking.value = false
        when (answer) {
            is WritingStartAnswer.Writing -> {
                mutableState.value = WritingStartState.Writing(answer.generationId)
                follow(answer.generationId)
            }

            null -> {
                mutableState.value = WritingStartState.Failed
            }

            else -> {
                settle(answer)
            }
        }
    }

    private suspend fun start(): WritingStartAnswer? = (store.start(blockId) as? MutationResult.Done)?.value

    private suspend fun settle(answer: WritingStartAnswer) {
        mutableState.value =
            when (answer) {
                is WritingStartAnswer.Ready -> WritingStartState.Ready.also { store.essays[blockId].refresh() }
                is WritingStartAnswer.LimitReached -> WritingStartState.LimitReached
                else -> WritingStartState.Failed
            }
    }
}
