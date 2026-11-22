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
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.StartLanguageLevelTestInput
import com.zoonk.api.models.StartLanguageLevelTestOutInput
import com.zoonk.api.models.TapAnswer
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * A language course's level test from its plan (main's `useLanguagePlanTest`): the learner picks a
 * length or a level's test-out, and the test opened keeps its attempt across a recreation. Opening
 * it only reads; starting, answering and finishing are POSTs from the learner's taps.
 */
internal class LevelTestPlanViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
    /** This visit to the test: a save that fails, and the topic walk opening, show only on it. */
    val visit = Visit()

    /** The whole-course test's walk through the course's topics opened: the frame goes on to it. */
    val walking = visit.outcome<Unit>()

    private val failure = visit.outcome<Unit>()
    private val saveFailure = visit.outcome<Int>()

    private var savedAttempt by handle.saved { "" }
    private var savedTestOut by handle.saved { "" }

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

    fun start(length: PlacementLength) =
        save(Pressed.Main) {
            val asked =
                if (length ==
                    PlacementLength.WHOLE_COURSE
                ) {
                    StartLanguageLevelTestInput.Length.WHOLE_COURSE
                } else {
                    StartLanguageLevelTestInput.Length.QUICK
                }
            when (val started = store.startLevelTest(goalId, asked)) {
                is WriteOutcome.Done -> started.value.attemptId?.let(::openAttempt) != null
                WriteOutcome.Obsolete -> true
                else -> false
            }
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

    /** Onboarding's Skip before a test opened: ends the one that never opened, then [saveStep] goes on. */
    fun skip(saveStep: suspend () -> WriteOutcome<*>) =
        save(Pressed.Other) {
            when (store.finishLevelTest(goalId)) {
                is WriteOutcome.Done -> saveStep().let { it is WriteOutcome.Done || it == WriteOutcome.Obsolete }
                WriteOutcome.Obsolete -> true
                else -> false
            }
        }

    /** After a whole-course level test, opens its walk through the course's topics. */
    fun walkTopics() =
        save(Pressed.Main) { asked ->
            val opened = store.startPlacementSitting(goalId, PlacementLength.WHOLE_COURSE)
            if (opened is WriteOutcome.Done) walking.send(asked, Unit)
            opened is WriteOutcome.Done || opened == WriteOutcome.Obsolete
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
