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
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestGeneration
import com.zoonk.api.models.LanguageLevelTestResult
import kotlinx.coroutines.launch
import java.util.UUID

private data class SentTestAnswer(
    val questionId: String,
    val answerIndex: Long?,
    val answerIndices: List<Long>?,
    val durationMs: Long,
    val skipped: Boolean,
)

/**
 * Opening it only reads; only the learner's Start asks for a language pair's questions, and
 * answering and finishing are POSTs from their taps. [saveStep] saves the setup's placement step
 * once the test is finished. With an [attemptId], it's a test the plan's Start already opened: its
 * questions show at once, and the test closes itself once it asks nothing more, leaving its [result].
 */
internal class LevelTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
    private val attemptId: UUID? = null,
    private val saveStep: suspend () -> WriteOutcome<*>,
) : ViewModel() {
    /** This visit to the test: a save that fails says so only on it. */
    val visit = Visit()

    private var savedStarted by handle.saved { attemptId != null }

    private var started by mutableStateOf(savedStarted)

    /** The wait shows from this screen's Start until the questions arrive or writing them stops. */
    private var begun by mutableStateOf(attemptId != null)

    private var stopped by mutableStateOf(false)

    var bank by mutableStateOf(if (attemptId != null) BankWait(askedAt = now()) else BankWait())
        private set

    /** A plan's test, once closed: its ranges and what it skipped. */
    var result by mutableStateOf<LanguageLevelTestResult?>(null)
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

    private val test get() = store.levelTest(goalId, attemptId)
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

    /**
     * [answer] is a pick, a confirmation's picks, or "I don't know"; a [skipped] listening question doesn't count toward
     * a level.
     */
    fun answer(
        questionId: String,
        answer: Answer,
        durationMs: Long,
        skipped: Boolean = false,
    ) {
        if (isSaving) return
        finishFailure.clear()
        val started = visit.number
        val previous = sent
        val answerIndex = (answer as? Answer.Choice)?.index?.toLong()
        val answerIndices = (answer as? Answer.Choices)?.indexes?.map(Int::toLong)
        val duration =
            previous
                ?.takeIf {
                    it.copy(durationMs = durationMs) == SentTestAnswer(questionId, answerIndex, answerIndices, durationMs, skipped)
                }?.durationMs ?: durationMs
        val sending = SentTestAnswer(questionId, answerIndex, answerIndices, duration, skipped)
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
            sent = sending
            val saved =
                store.answerLevelTest(
                    goalId,
                    sending.questionId,
                    sending.answerIndex,
                    sending.durationMs,
                    sending.skipped,
                    attemptId,
                    sending.answerIndices,
                )
            when (saved) {
                is WriteOutcome.Done -> {
                    sent = null
                    saveFailure.clear()
                    finishFailure.clear()
                    // A plan's test that asks nothing more closes in the same save; if that fails, its levels hold the retry.
                    if (attemptId != null && phase(test.state.value) is LevelTestPhase.Done) {
                        isSaving = false
                        finish()
                        return@launch
                    }
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
            val outcome = store.finishLevelTest(goalId, attemptId)
            if (outcome is WriteOutcome.Done && attemptId != null) result = outcome.value
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
