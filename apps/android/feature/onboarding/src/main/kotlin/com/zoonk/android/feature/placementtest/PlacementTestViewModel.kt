package com.zoonk.android.feature.placementtest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Visit
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PlacementPart
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.refreshed
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.tap
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/**
 * A course's test, in onboarding and from the plan (main's `usePlacementTest`). Opening it only reads; starting a part,
 * answering and closing a part are POSTs from the learner's taps. A part that asks nothing more closes in the same save.
 */
internal class PlacementTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
    /** This visit to the test: a save that fails says so only on it. */
    val visit = Visit()

    /** When this visit began and whether it opened a sitting, for the first question's analytics. */
    val sitting = TestVisit()

    /** Onboarding's "First lesson" saved the learner's choice to start from scratch: the setup goes on. */
    val declined = visit.outcome<Unit>()

    private val failure = visit.outcome<Unit>()
    private val saveFailure = visit.outcome<Int>()

    private var savedClosed by handle.saved { "" }
    private var autoStarted by handle.saved { false }

    /** What a part closed in this visit did, shown until the learner moves on, after a reclaimed process too. */
    private var closed by mutableStateOf(
        savedClosed
            .takeIf {
                it.isNotEmpty()
            }?.let { ApiJson.decodeFromString(ClosedPart.serializer(), it).phase },
    )

    var pressed by mutableStateOf<Pressed?>(null)
        private set

    var answering by mutableStateOf(false)
        private set

    val failed get() = failure.value != null

    /** Answers or a stop that didn't save on this visit, said on the question they came from. */
    val saveFailures get() = saveFailure.value ?: 0

    val busy get() = pressed != null || answering

    /** [finished]: a test that's over shows its result rather than a new offer, as onboarding does. */
    fun phase(
        placement: LoadState<Placement>,
        finished: Boolean = false,
    ) = placementTestPhase(placement, closed, finished)

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean = store.placements[goalId].refreshed()

    /** Opens a test of this [length], the next part of the open one, or the one the learner stopped. */
    fun start(
        length: PlacementLength,
        button: Pressed = Pressed.Main,
    ) = save(button) {
        sitting.started()
        open(length)
    }

    /** A learner who asked for the test on the level question goes straight in, once. */
    fun startAsked() {
        if (autoStarted) return
        autoStarted = true
        start(PlacementLength.QUICK)
    }

    /** Onboarding's "First lesson": every phase starts at its beginning. */
    fun decline() =
        save(Pressed.Main) { asked ->
            val finished = store.finishPlacement(goalId, fromScratch = true)
            if (finished is WriteOutcome.Done) declined.send(asked, Unit)
            finished is WriteOutcome.Done || finished == WriteOutcome.Obsolete
        }

    /** Closes a part the learner came back to after its questions ran out. */
    fun finishPart(attempt: PlacementAttempt) = save(Pressed.Main) { close(attempt) }

    /** Moves on from what a closed part showed, to the test as the server has it. */
    fun dismissClosed() = show(null)

    fun answer(
        question: PlacementTestPhase.Question,
        answer: Answer,
        durationMs: Long,
    ) {
        val tap = answer.tap() ?: return
        if (busy) return
        answering = true
        failure.clear()
        val asked = visit.number
        val attempt = question.attempt
        viewModelScope.launch {
            when (val sent = store.answerPlacement(goalId, question.item.itemId, tap, durationMs, attempt.part())) {
                is WriteOutcome.Done -> {
                    saveFailure.clear()
                    if (sent.value.placement.partOver() != null && !close(attempt)) failure.send(asked, Unit)
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailure.send(asked, saveFailures + 1)
                }
            }
            answering = false
        }
    }

    /** "Stop and use my answers": closes the part with the answers the learner saw. */
    fun stop(question: PlacementTestPhase.Question) {
        if (busy) return
        answering = true
        val asked = visit.number
        viewModelScope.launch {
            if (!close(question.attempt, answered = question.attempt.answered)) saveFailure.send(asked, saveFailures + 1)
            answering = false
        }
    }

    private suspend fun open(length: PlacementLength): Boolean =
        when (val started = store.startPlacementSitting(goalId, length)) {
            is WriteOutcome.Done -> {
                show(null)
                started.value.partOver()?.let { close(it) } ?: true
            }

            WriteOutcome.Obsolete -> {
                true
            }

            else -> {
                false
            }
        }

    /** Closing a part applies what it skipped; another device that closed it first wins, and the read says where the test is. */
    private suspend fun close(
        attempt: PlacementAttempt,
        answered: Long? = null,
    ): Boolean {
        val finished = store.finishPlacement(goalId, fromScratch = false, attempt = attempt.part(), answered = answered)
        if (finished is WriteOutcome.Done) {
            show(finished.value.phase(attempt))
            return true
        }
        if (finished == WriteOutcome.Obsolete) return true
        val placements = store.placements[goalId]
        if (!placements.refreshed()) return false
        val now =
            placements.state.value.value
                ?.attempt
        return now == null || now.id != attempt.id || now.part != attempt.part || now.partComplete || now.resume != null
    }

    private fun show(part: PlacementTestPhase?) {
        closed = part
        savedClosed = part?.let { ApiJson.encodeToString(ClosedPart.serializer(), ClosedPart.of(it)) }.orEmpty()
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

/** What a closed part shows, as a reclaimed process restores it. */
@Serializable
private data class ClosedPart(
    val done: PlacementTestPhase.PartDone? = null,
    val stopped: PlacementTestPhase.PartStopped? = null,
    val result: PlacementTestPhase.Result? = null,
) {
    val phase: PlacementTestPhase? get() = done ?: stopped ?: result

    companion object {
        fun of(phase: PlacementTestPhase) =
            ClosedPart(
                done = phase as? PlacementTestPhase.PartDone,
                stopped = phase as? PlacementTestPhase.PartStopped,
                result = phase as? PlacementTestPhase.Result,
            )
    }
}

internal fun PlacementAttempt.part() = PlacementPart(id, part)
