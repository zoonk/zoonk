package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswer
import kotlinx.coroutines.launch

private class SentAnswer(
    val question: PlacementPhase.Question,
    val answer: PlacementAnswer,
    val durationMs: Long,
)

/** Main's `PlacementStep`: answering and finishing are POSTs from the learner's taps; opening it only reads. */
internal class PlacementViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
    private var savedStarted by handle.saved { false }

    var started by mutableStateOf(savedStarted)
        private set

    var isSaving by mutableStateOf(false)
        private set

    var answerFailed by mutableStateOf(false)
        private set

    var finishFailed by mutableStateOf(false)
        private set

    private var sent: SentAnswer? = null
    private var shown = Shown()

    fun phase(
        placement: LoadState<Placement>,
        mocks: LoadState<MockOptions>,
    ): PlacementPhase =
        placementPhase(placement, mocks, started, shown).also {
            if (it is PlacementPhase.Question) shown = Shown(answered = it.number - 1, spent = it.spent)
        }

    fun start() {
        started = true
        savedStarted = true
    }

    fun answer(
        question: PlacementPhase.Question,
        answer: PlacementAnswer,
        durationMs: Long,
    ) {
        if (isSaving) return
        sent = SentAnswer(question, answer, durationMs)
        send()
    }

    fun retryAnswer() {
        if (!isSaving) send()
    }

    /** Stopping a mock exam the learner left first finishes it, so its answers place them too. */
    fun finish(
        fromScratch: Boolean,
        stopMockId: String? = null,
        onDone: () -> Unit,
    ) {
        if (isSaving) return
        isSaving = true
        finishFailed = false
        viewModelScope.launch {
            val stopped = stopMockId?.let { store.stopPlacementMock(goalId, it) }
            val outcome = if (stopped == null || stopped is WriteOutcome.Done) store.finishPlacement(goalId, fromScratch) else stopped
            when (outcome) {
                is WriteOutcome.Done -> {
                    onDone()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    finishFailed = true
                }
            }
            isSaving = false
        }
    }

    private fun send() {
        val answer = sent ?: return
        start()
        isSaving = true
        answerFailed = false
        viewModelScope.launch {
            when (store.answerPlacement(goalId, answer.question.item.itemId, answer.answer, answer.durationMs)) {
                is WriteOutcome.Done -> {
                    shown = shown.copy(answered = maxOf(shown.answered, answer.question.number))
                    sent = null
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    answerFailed = true
                }
            }
            isSaving = false
        }
    }
}
