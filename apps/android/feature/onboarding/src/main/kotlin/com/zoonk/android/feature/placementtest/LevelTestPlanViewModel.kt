package com.zoonk.android.feature.placementtest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.LevelTestAttempt
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.attemptId
import com.zoonk.android.feature.onboarding.setup.refreshed
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.tap
import com.zoonk.api.models.LanguageLevelTestOutAnswerInputAnswer
import com.zoonk.api.models.StartLanguageLevelTestOutInput
import com.zoonk.api.models.TapAnswer
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * A language course's level test, in onboarding and from its plan (main's `useLanguagePlanTest`): the learner starts
 * the test or a level's test-out, and the test opened keeps its attempt across a recreation. Opening it only reads;
 * starting, answering and finishing are POSTs from the learner's taps.
 */
internal class LevelTestPlanViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
    val visit = Visit()

    /** When this visit began and whether it opened the test, for the first question's analytics. */
    val sitting = TestVisit()

    private val failure = visit.outcome<Unit>()
    private val saveFailure = visit.outcome<Int>()

    private var savedAttempt by handle.saved { "" }
    private var savedTestOut by handle.saved { "" }
    private var autoStarted by handle.saved { false }

    /** The level test the learner opened, which its steps read. */
    var attemptId by mutableStateOf(savedAttempt.toUuid())
        private set

    /** The level test-out the learner opened. */
    var testOutId by mutableStateOf(savedTestOut.toUuid())
        private set

    var pressed by mutableStateOf<Pressed?>(null)
        private set

    var answering by mutableStateOf(false)
        private set

    val failed get() = failure.value != null

    val saveFailures get() = saveFailure.value ?: 0

    val busy get() = pressed != null || answering

    /** The accepted start: it opens the test, or answers with the one already open. */
    fun start() =
        save(Pressed.Main) {
            sitting.started()
            when (val started = store.startLevelTest(goalId)) {
                is WriteOutcome.Done -> started.value.attemptId?.let(::openAttempt) != null
                WriteOutcome.Obsolete -> true
                else -> false
            }
        }

    /** A learner who asked for the test on the level question goes straight in, once. */
    fun startAsked() {
        if (autoStarted) return
        autoStarted = true
        start()
    }

    /** Goes on with the test read without an attempt, which onboarding opened earlier. */
    fun resume(id: UUID) {
        if (attemptId == null) openAttempt(id)
    }

    /** [button] is the one the learner pressed: the length screen's Start, or the level result's other action. */
    fun testOut(
        level: String,
        button: Pressed = Pressed.Main,
    ) = save(button) {
        val asked = StartLanguageLevelTestOutInput.Level.entries.firstOrNull { it.value == level } ?: return@save false
        when (val started = store.startLevelTestOut(goalId, asked)) {
            is WriteOutcome.Done -> {
                testOutId = started.value.attemptId
                savedTestOut = started.value.attemptId.toString()
                true
            }

            WriteOutcome.Obsolete -> {
                true
            }

            else -> {
                false
            }
        }
    }

    /** One of the test-out wait's reads: true when it came back. */
    suspend fun checkTestOut(): Boolean = testOutId?.let { store.levelTestOuts[LevelTestAttempt(goalId, it)].refreshed() } ?: false

    /** A test-out's answer; the last one closes the test-out in the same save. */
    fun answerTestOut(
        itemId: String,
        answer: Answer,
        durationMs: Long,
    ) {
        val attempt = testOutId ?: return
        val sent = answer.tap()?.testOutAnswer() ?: return
        if (busy) return
        answering = true
        val asked = visit.number
        viewModelScope.launch {
            when (val saved = store.answerLevelTestOut(goalId, attempt, itemId, sent, durationMs)) {
                is WriteOutcome.Done -> {
                    saveFailure.clear()
                    if (saved.value.next == null && saved.value.result == null && !closeTestOut(attempt)) {
                        saveFailure.send(asked, saveFailures + 1)
                    }
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailure.send(asked, saveFailures + 1)
                }
            }
            answering = false
        }
    }

    /** "Stop and use my answers" on a test-out: skips what its answers so far confirm. */
    fun stopTestOut() {
        val attempt = testOutId ?: return
        if (busy) return
        answering = true
        val asked = visit.number
        viewModelScope.launch {
            if (!closeTestOut(attempt)) saveFailure.send(asked, saveFailures + 1)
            answering = false
        }
    }

    private suspend fun closeTestOut(attempt: UUID): Boolean {
        val finished = store.finishLevelTestOut(goalId, attempt)
        return finished is WriteOutcome.Done || finished == WriteOutcome.Obsolete
    }

    private fun openAttempt(id: UUID) {
        attemptId = id
        savedAttempt = id.toString()
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

private fun String.toUuid(): UUID? = takeIf(String::isNotEmpty)?.let(UUID::fromString)

/** A test-out takes the same taps as placement, in its own generated type. */
private fun TapAnswer.testOutAnswer(): LanguageLevelTestOutAnswerInputAnswer =
    when (this) {
        is TapAnswer.ChoiceAnswerValue -> LanguageLevelTestOutAnswerInputAnswer.ChoiceAnswerValue(value)
        is TapAnswer.MatchAnswerValue -> LanguageLevelTestOutAnswerInputAnswer.MatchAnswerValue(value)
        is TapAnswer.OrderAnswerValue -> LanguageLevelTestOutAnswerInputAnswer.OrderAnswerValue(value)
    }
