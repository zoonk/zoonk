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
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.api.models.CertificateFacts
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestGeneration
import com.zoonk.api.models.LanguageLevelTestSpokenResult
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

    var answerFailed by mutableStateOf(false)
        private set

    var finishFailed by mutableStateOf(false)
        private set

    /** The finish ran: its levels place the plan, and Build my plan only moves on. */
    var finished by mutableStateOf(false)
        private set

    /** The placement certificate the finish answered with; null when the test earned none. */
    var placement by mutableStateOf<CertificateFacts?>(null)
        private set

    /** The learner answered here, so the test ending after one of their answers is finished at once. */
    private var answered = false

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
        answered = true
        sent = SentTestAnswer(questionId, answerIndex, durationMs, skipped)
        send()
    }

    suspend fun speak(recording: VoiceRecording): GradeOutcome<LanguageLevelTestSpokenResult> {
        answered = true
        return store.speakLevelTest(goalId, recording)
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

    /** The learner leaves the questions for the levels they have so far, saved so reopening the test shows them too. */
    fun stop() {
        if (isSaving) return
        stopped = true
        finish {}
    }

    /**
     * Main's: the learner's last answer ends the test, which is finished then, so its last screen
     * shows the placement it earned. A test that only reads as ended (reopened, or finished
     * elsewhere) waits for Build my plan.
     */
    fun follow(phase: LevelTestPhase) {
        if (phase is LevelTestPhase.Done && answered && !finished) finish {}
    }

    fun buildPlan(onDone: () -> Unit) = if (finished) onDone() else finish(onDone)

    fun finish(onDone: () -> Unit) {
        if (isSaving) return
        isSaving = true
        finishFailed = false
        viewModelScope.launch {
            when (val outcome = store.finishLevelTest(goalId)) {
                is WriteOutcome.Done -> {
                    finished = true
                    placement = outcome.value?.certificate
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
            when (store.answerLevelTest(goalId, answer.questionId, answer.answerIndex, answer.durationMs, answer.skipped)) {
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
