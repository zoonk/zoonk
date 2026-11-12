package com.zoonk.android.feature.focustest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.SetupDrafts
import com.zoonk.android.feature.onboarding.setup.refreshed
import com.zoonk.android.feature.onboarding.setup.typedDraftStep
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswer
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import kotlinx.coroutines.launch
import java.util.UUID

/** The button a save started from, which shows it's busy while the other waits. */
internal enum class Pressed { Main, Other }

/** The learner's answer to the checkpoint's proposed focus, and the change as it now stands. */
internal data class ProposalAnswer(
    val status: PlanChangeDecisionInput.Status,
    val change: PlanChange,
)

/** The host's way out of the test: onboarding saves its step, a plan goes back to it. */
internal typealias LeaveTest = suspend () -> WriteOutcome<*>

/**
 * An exam goal's Focus test, in onboarding or opened from the plan. Starting, answering and closing
 * are POSTs from the learner's taps; opening it only reads.
 */
internal class FocusTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    private val plans: PlanStore,
    private val drafts: SetupDrafts?,
    handle: SavedStateHandle,
) : ViewModel() {
    private var savedEntered by handle.saved { false }

    /** The learner started or resumed a sitting in this visit, so its questions show instead of its resume screen. */
    private var entered by mutableStateOf(savedEntered)

    private var closed by mutableStateOf<FocusTest?>(null)

    /** Sittings entered in this visit: a proposal's answer belongs to the result before the next one. */
    private var sittings = 0

    var pressed by mutableStateOf<Pressed?>(null)
        private set

    var failed by mutableStateOf(false)
        private set

    var answering by mutableStateOf(false)
        private set

    /** Answers or a stop that didn't save, said on the question they came from. */
    var saveFailures by mutableStateOf(0)
        private set

    var proposalAnswer by mutableStateOf<ProposalAnswer?>(null)
        private set

    var deciding by mutableStateOf<PlanChangeDecisionInput.Status?>(null)
        private set

    var decisionFailed by mutableStateOf(false)
        private set

    val busy get() = pressed != null || answering

    fun phase(placement: LoadState<Placement>): FocusTestPhase = focusTestPhase(placement, entered, closed)

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean = store.placements[goalId].refreshed()

    fun start(onDone: LeaveTest) =
        save(Pressed.Main) {
            when (val started = store.startPlacementSitting(goalId)) {
                is WriteOutcome.Done -> {
                    enter()
                    started.value.sittingOver()?.let { close(onDone) } ?: true
                }

                WriteOutcome.Obsolete -> {
                    true
                }

                else -> {
                    false
                }
            }
        }

    /** The result's "Answer more questions": the same start, from its other button. */
    fun continueTest() =
        save(Pressed.Other) {
            val started = store.startPlacementSitting(goalId)
            if (started is WriteOutcome.Done) enter()
            started !is WriteOutcome.Failed && started !is WriteOutcome.Refused
        }

    fun resume() = enter()

    fun answer(
        question: FocusTestPhase.Question,
        answer: PlacementAnswer,
        durationMs: Long,
        onDone: LeaveTest,
    ) {
        if (busy) return
        answering = true
        failed = false
        val draft = drafts?.sending(goalId, typedDraftStep(question.item.itemId))
        viewModelScope.launch {
            when (val sent = store.answerPlacement(goalId, question.item.itemId, answer, durationMs)) {
                is WriteOutcome.Done -> {
                    saveFailures = 0
                    draft?.remove()
                    // A sitting that's over closes in the same save; if that fails, its screen holds the retry.
                    if (sent.value.placement.sittingOver() != null) failed = !close(onDone)
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailures++
                }
            }
            answering = false
        }
    }

    /** "Stop and use my answers": closes the sitting with what it has. */
    fun stop(onDone: LeaveTest) {
        if (busy) return
        answering = true
        viewModelScope.launch {
            if (!close(onDone)) saveFailures++
            answering = false
        }
    }

    /** "See my result" on a sitting that's over. */
    fun finish(onDone: LeaveTest) = save(Pressed.Main) { close(onDone) }

    /** A learner who never started has nothing to close on a plan that's already theirs. */
    fun leave(
        closes: Boolean,
        onDone: LeaveTest,
    ) = save(Pressed.Other) { if (closes) close(onDone) else handBack(onDone) }

    fun done(onDone: LeaveTest) = save(Pressed.Main) { handBack(onDone) }

    fun decide(
        change: PlanChange,
        status: PlanChangeDecisionInput.Status,
    ) {
        if (deciding != null) return
        val on = sittings
        deciding = status
        decisionFailed = false
        viewModelScope.launch {
            val result = plans.decideChange(UUID.fromString(goalId), change.id, status)
            if (on != sittings) return@launch
            when (result) {
                is MutationResult.Done -> {
                    proposalAnswer = ProposalAnswer(status, result.value)
                }

                is MutationResult.Failed -> {
                    decisionFailed = true
                }

                MutationResult.Obsolete -> {}
            }
            deciding = null
        }
    }

    /** A sitting's answers make a new result, so the answer to the last result's proposal stays with it. */
    private fun enter() {
        entered = true
        savedEntered = true
        closed = null
        sittings++
        proposalAnswer = null
        deciding = null
        decisionFailed = false
    }

    /** Closing applies the answers; a test that still has none is only skipped, and the host moves on. */
    private suspend fun close(onDone: LeaveTest): Boolean {
        val finished = store.finishPlacement(goalId, fromScratch = false)
        if (finished !is WriteOutcome.Done) return finished == WriteOutcome.Obsolete
        val test = finished.value.focusTest?.takeIf { it.checkpoint != null } ?: return handBack(onDone)
        entered = false
        savedEntered = false
        closed = test
        return true
    }

    private suspend fun handBack(onDone: LeaveTest): Boolean = onDone().let { it is WriteOutcome.Done || it == WriteOutcome.Obsolete }

    private fun save(
        button: Pressed,
        action: suspend () -> Boolean,
    ) {
        if (busy) return
        pressed = button
        failed = false
        viewModelScope.launch {
            failed = !action()
            pressed = null
        }
    }
}
