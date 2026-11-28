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
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.refreshed
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.tap
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAttempt
import kotlinx.coroutines.launch

/**
 * A course's test, in onboarding and from the plan (main's `usePlacementTest`). Opening it only reads; starting it,
 * answering and closing it are POSTs from the learner's taps. A test that asks nothing more closes in the same save.
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
    private val askedStart = AskedStart(visit)

    private var savedClosed by handle.saved { "" }

    /** The server accepted the learner's start in this visit. */
    private var accepted by handle.saved { false }

    /** The learner's last start came back before the course had questions: it opens once they're written. */
    private var awaiting by handle.saved { false }

    /** What the test closed in this visit showed, kept after a reclaimed process too; [phase] shows it while the read agrees. */
    private var closed by mutableStateOf(
        savedClosed.takeIf { it.isNotEmpty() }?.let { ApiJson.decodeFromString(ClosedTest.serializer(), it) },
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
    ) = placementTestPhase(placement, closed, finished, asked = accepted, awaiting = awaiting)

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean = store.placements[goalId].refreshed()

    /** Opens the test, or the one that's open. */
    fun start() =
        save(Pressed.Main) {
            sitting.started()
            open()
        }

    /** A learner who asked for the test on the level question goes straight in. */
    fun startAsked() {
        if (askedStart.take(busy)) start()
    }

    /** Onboarding's "First lesson": every phase starts at its beginning. */
    fun decline() =
        save(Pressed.Main) { asked ->
            val finished = store.finishPlacement(goalId, fromScratch = true)
            if (finished is WriteOutcome.Done) declined.send(asked, Unit)
            finished is WriteOutcome.Done || finished == WriteOutcome.Obsolete
        }

    /** Closes a test the learner came back to after its questions ran out. */
    fun finish(attempt: PlacementAttempt) = save(Pressed.Main) { close(attempt) }

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
            when (val sent = store.answerPlacement(goalId, question.item.itemId, tap, durationMs, attempt.id)) {
                is WriteOutcome.Done -> {
                    saveFailure.clear()
                    if (sent.value.placement.over() != null && !close(attempt)) failure.send(asked, Unit)
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailure.send(asked, saveFailures + 1)
                }
            }
            answering = false
        }
    }

    /** "Stop and use my answers": closes the test with the answers the learner saw. */
    fun stop(question: PlacementTestPhase.Question) {
        if (busy) return
        answering = true
        val asked = visit.number
        viewModelScope.launch {
            if (!close(question.attempt, answered = question.attempt.answered)) saveFailure.send(asked, saveFailures + 1)
            answering = false
        }
    }

    private suspend fun open(): Boolean =
        when (val started = store.startPlacementSitting(goalId)) {
            is WriteOutcome.Done -> {
                show(null)
                accepted = true
                awaiting = started.value.attempt == null && !started.value.isReady
                started.value.over()?.let { close(it) } ?: true
            }

            WriteOutcome.Obsolete -> {
                true
            }

            else -> {
                false
            }
        }

    /**
     * Closing the test applies what it skipped; another device that closed it first, or answered past a stop's
     * [answered], wins, and the read says where the test is. A close that saved but whose reply was lost shows the
     * result the read now has for this attempt.
     */
    private suspend fun close(
        attempt: PlacementAttempt,
        answered: Long? = null,
    ): Boolean {
        val finished = store.finishPlacement(goalId, fromScratch = false, attemptId = attempt.id, answered = answered)
        if (finished is WriteOutcome.Done) {
            show(finished.value.closed(attempt))
            return true
        }
        if (finished == WriteOutcome.Obsolete) return true
        val placements = store.placements[goalId]
        if (!placements.refreshed()) return false
        val read = placements.state.value.value
        val saved = read?.result?.takeIf { read.attempt == null && it.attemptId == attempt.id }
        if (saved != null) {
            show(ClosedTest(attempt.id, saved.phase()))
            return true
        }
        val now = read?.attempt
        return now == null || now.id != attempt.id || (answered != null && now.answered != answered)
    }

    private fun show(test: ClosedTest?) {
        closed = test
        savedClosed = test?.let { ApiJson.encodeToString(ClosedTest.serializer(), it) }.orEmpty()
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
