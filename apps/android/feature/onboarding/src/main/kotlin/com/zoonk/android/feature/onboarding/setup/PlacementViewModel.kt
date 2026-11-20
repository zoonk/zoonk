package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswer
import kotlinx.coroutines.launch

private class SentAnswer(
    val question: PlacementPhase.Question,
    val answer: PlacementAnswer,
    val durationMs: Long,
)

/**
 * Answering and finishing are POSTs from the learner's taps; opening it only reads. [saveStep] saves
 * the setup's placement step once the test is finished.
 */
internal class PlacementViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    private val drafts: SetupDrafts?,
    handle: SavedStateHandle,
    private val saveStep: suspend () -> WriteOutcome<*>,
) : ViewModel() {
    /** This visit to the test: a save that fails says so only on it. */
    val visit = Visit()

    private var savedStarted by handle.saved { false }

    var started by mutableStateOf(savedStarted)
        private set

    var isSaving by mutableStateOf(false)
        private set

    private val saveFailure = visit.outcome<Int>()
    private val finishFailure = visit.outcome<Unit>()

    /** Answers or a stop that didn't save on this visit, said on the question they came from. */
    val saveFailures get() = saveFailure.value ?: 0

    val finishFailed get() = finishFailure.value != null

    var isStarting by mutableStateOf(false)
        private set

    // A question read before Start may have been answered in another tab or on another device, and the server rejects
    // answering it again, so only a read after Start opens one.
    private var awaitingRead by mutableStateOf(false)

    private var sent: SentAnswer? = null
    private var shown = Shown()

    fun phase(placement: LoadState<Placement>): PlacementPhase =
        if (awaitingRead) {
            PlacementPhase.Waiting
        } else {
            placementPhase(placement, started, shown).also {
                if (it is PlacementPhase.Question) shown = Shown(answered = it.number - 1, spent = it.spent)
            }
        }

    /** Reads first, so ready questions open at once instead of flashing their wait. */
    fun start() {
        if (isStarting) return
        finishFailure.clear()
        isStarting = true
        viewModelScope.launch {
            awaitingRead = !check()
            markStarted()
            isStarting = false
        }
    }

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean = store.placements[goalId].refreshed().also { if (it) awaitingRead = false }

    private fun markStarted() {
        started = true
        savedStarted = true
    }

    fun answer(
        question: PlacementPhase.Question,
        answer: PlacementAnswer,
        durationMs: Long,
    ) {
        if (isSaving) return
        finishFailure.clear()
        val previous = sent
        val duration = previous?.takeIf { it.question.item.itemId == question.item.itemId && it.answer == answer }?.durationMs ?: durationMs
        sent = SentAnswer(question, answer, duration)
        send()
    }

    /** Finishes the test, then saves the setup's step; a stop ([fromQuestion]) says a failure on its question. */
    fun finish(
        fromScratch: Boolean,
        fromQuestion: Boolean = false,
    ) {
        if (isSaving) return
        isSaving = true
        finishFailure.clear()
        val asked = visit.number
        viewModelScope.launch {
            val outcome = store.finishPlacement(goalId, fromScratch)
            val completed = if (outcome is WriteOutcome.Done) saveStep() else outcome
            when (completed) {
                is WriteOutcome.Done -> {
                    if (fromQuestion) saveFailure.clear()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    if (fromQuestion) {
                        saveFailure.send(asked, saveFailures + 1)
                    } else {
                        finishFailure.send(asked, Unit)
                    }
                }
            }
            isSaving = false
        }
    }

    private fun send() {
        val answer = sent ?: return
        val draft = drafts?.sending(goalId, typedDraftStep(answer.question.item.itemId))
        markStarted()
        isSaving = true
        val asked = visit.number
        viewModelScope.launch {
            when (store.answerPlacement(goalId, answer.question.item.itemId, answer.answer, answer.durationMs)) {
                is WriteOutcome.Done -> {
                    saveFailure.clear()
                    finishFailure.clear()
                    shown = shown.copy(answered = maxOf(shown.answered, answer.question.number))
                    sent = null
                    draft?.remove()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailure.send(asked, saveFailures + 1)
                }
            }
            isSaving = false
        }
    }
}

internal fun typedDraftStep(itemId: String) = "placement.$itemId"
