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
 * answering and finishing are POSTs from their taps.
 */
internal class LevelTestViewModel(
    private val goalId: String,
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
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

    var saveFailures by mutableStateOf(0)
        private set

    var finishFailed by mutableStateOf(false)
        private set

    private val test get() = store.levelTests[goalId]
    private var sent: SentTestAnswer? = null

    fun phase(state: LoadState<LanguageLevelTest>) = levelTestPhase(state, started, begun, stopped, bank)

    /** Reads first, so ready questions open at once instead of flashing the wait for questions still to write. */
    fun begin() {
        if (isStarting) return
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
                    saveFailures++
                    isSaving = false
                    return@launch
                }
                val current = (phase(test.state.value) as? LevelTestPhase.Question)?.question?.id
                if (current != questionId) {
                    sent = null
                    saveFailures = 0
                    finishFailed = false
                    isSaving = false
                    return@launch
                }
            }
            sent = answer
            when (store.answerLevelTest(goalId, answer.questionId, answer.answerIndex, answer.durationMs, answer.skipped)) {
                is WriteOutcome.Done -> {
                    sent = null
                    saveFailures = 0
                    finishFailed = false
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailures++
                }
            }
            isSaving = false
        }
    }

    /** The learner leaves the questions for the levels they have so far, saved so reopening the test shows them too. */
    fun stop() {
        if (isSaving) return
        finish { stopped = true }
    }

    fun finish(onDone: () -> Unit) {
        if (isSaving) return
        isSaving = true
        finishFailed = false
        viewModelScope.launch {
            when (store.finishLevelTest(goalId)) {
                is WriteOutcome.Done -> {
                    saveFailures = 0
                    onDone()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    finishFailed = true
                    saveFailures++
                }
            }
            isSaving = false
        }
    }

    private fun Resource<LanguageLevelTest>.preparing() = (state.value.value as? LanguageLevelTest.LanguageLevelTestOneOfValue)?.value

    private fun now() = SystemClock.elapsedRealtime()
}
