package com.zoonk.android.feature.placementtest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
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
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
import kotlinx.coroutines.launch

/**
 * The test taken from the plan (main's `usePlacementTest`). Opening it only reads; starting a part,
 * answering and closing a part are POSTs from the learner's taps. A part that asks nothing more
 * closes in the same save.
 */
internal class PlacementTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
) : ViewModel() {
    /** This visit to the test: a save that fails says so only on it. */
    val visit = Visit()

    private val failure = visit.outcome<Unit>()
    private val saveFailure = visit.outcome<Int>()

    /** What a part closed in this visit did, shown until the learner moves on. */
    private var closed by mutableStateOf<PlacementTestPhase?>(null)

    var pressed by mutableStateOf<Pressed?>(null)
        private set

    var answering by mutableStateOf(false)
        private set

    val failed get() = failure.value != null

    /** Answers or a stop that didn't save on this visit, said on the question they came from. */
    val saveFailures get() = saveFailure.value ?: 0

    val busy get() = pressed != null || answering

    fun phase(placement: LoadState<Placement>) = placementTestPhase(placement, closed)

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean = store.placements[goalId].refreshed()

    /** Opens a test of this [length], or the next part of the open one. */
    fun start(length: PlacementLength) = save(Pressed.Main) { open(length) }

    /** Closes a part the learner came back to after its questions ran out. */
    fun finishPart(attempt: PlacementAttempt) = save(Pressed.Main) { close(attempt) }

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

    /** "Stop and use my answers": closes the part with what it has. */
    fun stop(question: PlacementTestPhase.Question) {
        if (busy) return
        answering = true
        val asked = visit.number
        viewModelScope.launch {
            if (!close(question.attempt)) saveFailure.send(asked, saveFailures + 1)
            answering = false
        }
    }

    private suspend fun open(length: PlacementLength): Boolean =
        when (val started = store.startPlacementSitting(goalId, length)) {
            is WriteOutcome.Done -> {
                closed = null
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
    private suspend fun close(attempt: PlacementAttempt): Boolean {
        val finished = store.finishPlacement(goalId, fromScratch = false, attempt = attempt.part())
        if (finished is WriteOutcome.Done) {
            val completion = finished.value
            val skipped = completion.partLessonsSkipped?.toInt() ?: 0
            closed =
                completion.attempt?.let { PlacementTestPhase.Between(it, skipped) }
                    ?: PlacementTestPhase.Result(attempt.length, completion.result?.lessonsSkipped?.toInt() ?: skipped)
            return true
        }
        if (finished == WriteOutcome.Obsolete) return true
        val placements = store.placements[goalId]
        if (!placements.refreshed()) return false
        val now =
            placements.state.value.value
                ?.attempt
        return now == null || now.id != attempt.id || now.part != attempt.part || now.partComplete
    }

    private fun save(
        button: Pressed,
        action: suspend () -> Boolean,
    ) {
        if (busy) return
        pressed = button
        failure.clear()
        val asked = visit.number
        viewModelScope.launch {
            if (!action()) failure.send(asked, Unit)
            pressed = null
        }
    }
}

internal fun PlacementAttempt.part() = PlacementPart(id, part)
