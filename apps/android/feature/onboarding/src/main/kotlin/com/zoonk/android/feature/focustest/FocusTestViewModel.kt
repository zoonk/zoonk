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
import com.zoonk.android.data.Visit
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

/** What the host saves when the learner leaves the test: onboarding its step; a plan nothing. */
internal typealias LeaveTest = suspend () -> WriteOutcome<*>

/**
 * An exam goal's Focus test, in onboarding or opened from the plan. Starting, answering and closing
 * are POSTs from the learner's taps; opening it only reads. Leaving saves [hostSave], then publishes
 * [left] for the host's screen to act on.
 */
internal class FocusTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    private val plans: PlanStore,
    private val drafts: SetupDrafts?,
    handle: SavedStateHandle,
    private val hostSave: LeaveTest = { WriteOutcome.Done(Unit) },
) : ViewModel() {
    /** This visit to the test: leaving it, and a save that fails, show only on it. */
    val visit = Visit()

    /** The learner left the test and the host saved it: the host goes on. */
    val left = visit.outcome<Unit>()

    private val failure = visit.outcome<Unit>()
    private val saveFailure = visit.outcome<Int>()

    private var savedEntered by handle.saved { false }

    /** The learner started or resumed a sitting in this visit, so its questions show instead of its resume screen. */
    private var entered by mutableStateOf(savedEntered)

    private var closed by mutableStateOf<FocusTest?>(null)

    /** Sittings entered in this visit: a proposal's answer belongs to the result before the next one. */
    private var sittings = 0

    var pressed by mutableStateOf<Pressed?>(null)
        private set

    val failed get() = failure.value != null

    var answering by mutableStateOf(false)
        private set

    /** Answers or a stop that didn't save on this visit, said on the question they came from. */
    val saveFailures get() = saveFailure.value ?: 0

    /** The proposal accepted after its numbers moved, as it now stands: the result asks again with today's. */
    var repricedProposal by mutableStateOf<PlanChange?>(null)
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

    fun start() =
        save(Pressed.Main) { asked ->
            when (val started = store.startPlacementSitting(goalId)) {
                is WriteOutcome.Done -> {
                    enter()
                    started.value.sittingOver()?.let { close(asked) } ?: true
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
    ) {
        if (busy) return
        answering = true
        failure.clear()
        val asked = visit.number
        val draft = drafts?.sending(goalId, typedDraftStep(question.item.itemId))
        viewModelScope.launch {
            when (val sent = store.answerPlacement(goalId, question.item.itemId, answer, durationMs)) {
                is WriteOutcome.Done -> {
                    saveFailure.clear()
                    draft?.remove()
                    // A sitting that's over closes in the same save; if that fails, its screen holds the retry.
                    if (sent.value.placement.sittingOver() != null && !close(asked)) failure.send(asked, Unit)
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailure.send(asked, saveFailures + 1)
                }
            }
            answering = false
        }
    }

    /** "Stop and use my answers": closes the sitting with what it has. */
    fun stop() {
        if (busy) return
        answering = true
        val asked = visit.number
        viewModelScope.launch {
            if (!close(asked)) saveFailure.send(asked, saveFailures + 1)
            answering = false
        }
    }

    /** "See my result" on a sitting that's over. */
    fun finish() = save(Pressed.Main) { close(it) }

    /** A learner who never started has nothing to close on a plan that's already theirs. */
    fun leave(closes: Boolean) = save(Pressed.Other) { if (closes) close(it) else handBack(it) }

    fun done() = save(Pressed.Main) { handBack(it) }

    fun decide(
        change: PlanChange,
        status: PlanChangeDecisionInput.Status,
    ) {
        if (deciding != null) return
        val on = sittings
        deciding = status
        decisionFailed = false
        viewModelScope.launch {
            val result = plans.decideChange(UUID.fromString(goalId), change, status)
            if (on != sittings) return@launch
            when (result) {
                is MutationResult.Done -> {
                    val saved = result.value
                    val repriced = status == PlanChangeDecisionInput.Status.APPLIED && saved.status == PlanChange.Status.PROPOSED
                    repricedProposal = saved.takeIf { repriced }
                    proposalAnswer = ProposalAnswer(status, saved).takeIf { !repriced }
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
        repricedProposal = null
        deciding = null
        decisionFailed = false
    }

    /** Closing applies the answers; a test that still has none is only skipped, and the host moves on. */
    private suspend fun close(asked: Int): Boolean {
        val finished = store.finishPlacement(goalId, fromScratch = false)
        if (finished !is WriteOutcome.Done) return finished == WriteOutcome.Obsolete
        val test = finished.value.focusTest?.takeIf { it.checkpoint != null } ?: return handBack(asked)
        entered = false
        savedEntered = false
        closed = test
        return true
    }

    /** The host saves the test left, then goes on while the visit that [asked] lasts. */
    private suspend fun handBack(asked: Int): Boolean {
        val saved = hostSave()
        if (saved is WriteOutcome.Done) left.send(asked, Unit)
        return saved is WriteOutcome.Done || saved == WriteOutcome.Obsolete
    }

    /** [action] gets the visit it was asked on, and says whether it saved. */
    private fun save(
        button: Pressed,
        action: suspend (asked: Int) -> Boolean,
    ) {
        if (busy) return
        pressed = button
        failure.clear()
        val asked = visit.number
        viewModelScope.launch {
            if (!action(asked)) failure.send(asked, Unit)
            pressed = null
        }
    }
}
