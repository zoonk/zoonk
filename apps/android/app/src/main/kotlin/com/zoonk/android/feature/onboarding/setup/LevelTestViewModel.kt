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
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

private class SentTestAnswer(
    val questionId: String,
    val answerIndex: Long?,
    val durationMs: Long,
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

    var isSaving by mutableStateOf(false)
        private set

    var answerFailed by mutableStateOf(false)
        private set

    var finishFailed by mutableStateOf(false)
        private set

    private val test get() = store.levelTests[goalId]
    private var beginning: Job? = null
    private var sent: SentTestAnswer? = null

    fun phase(state: LoadState<LanguageLevelTest>) = levelTestPhase(state, started, begun, stopped, bank)

    fun begin() {
        if (beginning?.isActive == true) return
        started = true
        savedStarted = true
        begun = true
        bank = BankWait()
        beginning =
            viewModelScope.launch {
                test.refresh()
                val preparing = test.preparing() ?: return@launch
                if (preparing.startedAt != null) {
                    bank = bank.seen(preparing, now())
                    return@launch
                }
                val prepared = store.prepareLevelTest(goalId)
                bank = BankWait.asked(preparing, started = prepared is WriteOutcome.Done, now())
                if ((prepared as? WriteOutcome.Done)?.value?.status == LanguageLevelTestGeneration.Status.READY) test.refresh()
            }
    }

    /** One of the wait's reads: true when it came back. */
    suspend fun check(): Boolean {
        val read = test.refreshed()
        test.preparing()?.let { bank = bank.seen(it, now()) }
        return read
    }

    /** [answerIndex] is null for "I don't know". */
    fun answer(
        questionId: String,
        answerIndex: Long?,
        durationMs: Long,
    ) {
        if (isSaving) return
        sent = SentTestAnswer(questionId, answerIndex, durationMs)
        send()
    }

    /** A failed answer may have saved with only its reply lost: once the test moved past it, it isn't sent again. */
    fun retryAnswer() {
        val answer = sent ?: return
        if (isSaving) return
        isSaving = true
        viewModelScope.launch {
            test.refresh()
            val current = (phase(test.state.value) as? LevelTestPhase.Question)?.question?.id
            isSaving = false
            if (current == answer.questionId) {
                send()
            } else {
                sent = null
                answerFailed = false
            }
        }
    }

    /** The learner leaves the questions for the levels they have so far. */
    fun stop() {
        stopped = true
    }

    fun finish(onDone: () -> Unit) {
        if (isSaving) return
        isSaving = true
        finishFailed = false
        viewModelScope.launch {
            when (store.finishLevelTest(goalId)) {
                is WriteOutcome.Done -> {
                    onDone()
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    finishFailed = true
                }
            }
            isSaving = false
        }
    }

    private fun send() {
        val answer = sent ?: return
        isSaving = true
        answerFailed = false
        viewModelScope.launch {
            when (store.answerLevelTest(goalId, answer.questionId, answer.answerIndex, answer.durationMs)) {
                is WriteOutcome.Done -> {
                    sent = null
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    answerFailed = true
                }
            }
            isSaving = false
        }
    }

    private fun Resource<LanguageLevelTest>.preparing() = (state.value.value as? LanguageLevelTest.LanguageLevelTestOneOfValue)?.value

    private fun now() = SystemClock.elapsedRealtime()
}
