package com.zoonk.android.feature.onboarding.setup

import android.os.SystemClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.Visit
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestGeneration
import kotlinx.coroutines.launch

private class SentTestAnswer(
    val questionId: String,
    val answerIndex: Long?,
    val durationMs: Long,
    val skipped: Boolean,
)

/**
 * Opening it only reads; only the learner's Start asks for a language pair's questions, and
 * answering and finishing are POSTs from their taps. [saveStep] saves the setup's placement step
 * once the test is finished.
 */
internal class LevelTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
    private val saveStep: suspend () -> WriteOutcome<*>,
) : ViewModel() {
    /** This visit to the test: a save that fails says so only on it. */
    val visit = Visit()

    private var savedStarted by handle.saved { false }

    private var started by mutableStateOf(savedStarted)

    /** The wait shows from this screen's Start until the questions arrive or writing them stops. */
    private var begun by mutableStateOf(false)

    private var stopped by mutableStateOf(false)

    var bank by mutableStateOf(BankWait())
        private set

    var isStarting by mutableStateOf(false)
        private set

    var isSaving by mutableStateOf(false)
        private set

    private val saveFailure = visit.outcome<Int>()
    private val finishFailure = visit.outcome<Unit>()

    /** Answers or a stop that didn't save on this visit, said on the question they came from. */
    val saveFailures get() = saveFailure.value ?: 0

    val finishFailed get() = finishFailure.value != null

    private val test get() = store.levelTests[goalId]
    private var sent: SentTestAnswer? = null

    fun phase(state: LoadState<LanguageLevelTest>) = levelTestPhase(state, started, begun, stopped, bank)

    /** Reads first, so ready questions open at once instead of flashing the wait for questions still to write. */
    fun begin() {
        if (isStarting) return
        finishFailure.clear()
        isStarting = true
        bank = BankWait()
        viewModelScope.launch {
            val read = test.refreshed()
            begun = true
            // Left unstarted, a test whose read failed says so even over questions read before.
            if (read) {
                started = true
                savedStarted = true
            }
            val preparing = test.preparing()
            when {
                !read -> {
                    bank = BankWait(startFailed = true)
                }

                preparing == null -> {}

                preparing.startedAt != null -> {
                    bank = bank.seen(preparing, now())
                }

                else -> {
                    val prepared = store.prepareLevelTest(goalId)
                    bank = BankWait.asked(preparing, started = prepared is WriteOutcome.Done, now())
                    if ((prepared as? WriteOutcome.Done)?.value?.status == LanguageLevelTestGeneration.Status.READY) test.refresh()
                }
            }
            isStarting = false
        }
    }

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean {
        val read = test.refreshed()
        test.preparing()?.let { bank = bank.seen(it, now()) }
        return read
    }

    /** [answerIndex] is null for "I don't know"; a [skipped] listening question doesn't count toward a level. */
    fun answer(
        questionId: String,
        answerIndex: Long?,
        durationMs: Long,
        skipped: Boolean = false,
    ) {
        if (isSaving) return
        finishFailure.clear()
        val started = visit.number
        val previous = sent
        val duration =
            previous
                ?.takeIf {
                    it.questionId == questionId && it.answerIndex == answerIndex && it.skipped == skipped
                }?.durationMs ?: durationMs
        val answer = SentTestAnswer(questionId, answerIndex, duration, skipped)
        isSaving = true
        viewModelScope.launch {
            if (previous != null) {
                if (!test.refreshed()) {
                    saveFailure.send(started, saveFailures + 1)
                    isSaving = false
                    return@launch
                }
                val current = (phase(test.state.value) as? LevelTestPhase.Question)?.question?.id
                if (current != questionId) {
                    sent = null
                    saveFailure.clear()
                    finishFailure.clear()
                    isSaving = false
                    return@launch
                }
            }
            sent = answer
            when (store.answerLevelTest(goalId, answer.questionId, answer.answerIndex, answer.durationMs, answer.skipped)) {
                is WriteOutcome.Done -> {
                    sent = null
                    saveFailure.clear()
                    finishFailure.clear()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailure.send(started, saveFailures + 1)
                }
            }
            isSaving = false
        }
    }

    /** The learner leaves the questions for the levels they have so far, saved so reopening the test shows them too. */
    fun stop() {
        if (isSaving) return
        finish(fromQuestion = true) {
            stopped = true
            WriteOutcome.Done(Unit)
        }
    }

    fun skipSpeaking() {
        if (isSaving) return
        stopped = true
        finish(fromQuestion = false) { WriteOutcome.Done(Unit) }
    }

    /** "Continue" from the levels, or a skip: finishes the test, then saves the setup's step. */
    fun finish() = finish(fromQuestion = false, then = saveStep)

    private fun finish(
        fromQuestion: Boolean,
        then: suspend () -> WriteOutcome<*>,
    ) {
        if (isSaving) return
        isSaving = true
        finishFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            val outcome = store.finishLevelTest(goalId)
            val completed = if (outcome is WriteOutcome.Done) then() else outcome
            when (completed) {
                is WriteOutcome.Done -> {
                    if (fromQuestion) saveFailure.clear()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    if (fromQuestion) {
                        saveFailure.send(started, saveFailures + 1)
                    } else {
                        finishFailure.send(started, Unit)
                    }
                }
            }
            isSaving = false
        }
    }

    private fun Resource<LanguageLevelTest>.preparing() = (state.value.value as? LanguageLevelTest.LanguageLevelTestOneOfValue)?.value

    private fun now() = SystemClock.elapsedRealtime()
}
