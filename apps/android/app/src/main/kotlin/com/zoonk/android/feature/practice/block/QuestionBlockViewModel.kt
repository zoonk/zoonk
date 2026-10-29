package com.zoonk.android.feature.practice.block

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Question
import com.zoonk.api.models.CheckpointQuestionsInner
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockDetail
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.max

/** The block the learner plays, as the kit's questions. */
data class BlockQuestions(
    val detail: StudyBlockDetail,
    val questions: List<Question>,
)

/**
 * Plays one block: checks each answer, then finishes the block from the learner's last tap. The
 * run lives here; the block's questions stay the store's.
 */
class QuestionBlockViewModel(
    private val key: BlockKey,
    private val store: QuestionBlockStore,
    private val now: () -> Long = SystemClock::elapsedRealtime,
) : ViewModel() {
    private val run = MutableStateFlow<BlockRun?>(null)
    val state: StateFlow<BlockRun?> = run.asStateFlow()

    private val closing = MutableStateFlow(false)

    /** The block isn't open anymore (finished elsewhere) or the session stopped: the screen leaves. */
    val closed: StateFlow<Boolean> = closing.asStateFlow()

    private val stopping = MutableStateFlow<StopState>(StopState.Idle)
    val stop: StateFlow<StopState> = stopping.asStateFlow()

    private var shownAt = now()
    private var read: BlockQuestions? = null

    val block get() = store.blocks[key]

    fun questions(detail: StudyBlockDetail): BlockQuestions =
        read?.takeIf { it.detail === detail }
            ?: BlockQuestions(detail, detail.questions.map { it.recode<CheckpointQuestionsInner, Question>() }).also { read = it }

    /** Starts the run once its questions first show; later reads of the block keep it. */
    fun begin(questions: List<Question>) {
        if (run.value != null) return
        run.value = BlockRun.begin(questions)
        shownAt = now()
    }

    fun startDrill(questions: List<Question>) = run.update { it?.start(questions) }

    fun reveal() = run.update { it?.reveal() }

    /** [minDurationMs] is a timed drill's whole time when it ran out, however the clock ticked. */
    fun submit(
        question: Question,
        answer: Answer,
        minDurationMs: Long = 0,
    ) {
        val current = run.value ?: return
        if (!current.canAnswer) return
        run.value = current.checking()

        viewModelScope.launch {
            val duration = max(minDurationMs, now() - shownAt)
            when (val result = store.answer(key, question.itemId, answer, duration)) {
                is MutationResult.Done -> {
                    run.update { it?.answered(question.itemId, answer, result.value.recode<StudyAnswerFeedback, AnswerFeedback>()) }
                }

                is MutationResult.Failed -> {
                    when (result.code) {
                        ALREADY_ANSWERED -> run.update { it?.failed(BlockPhase.AlreadyAnswered) }
                        BLOCK_NOT_ACTIVE -> reread()
                        else -> run.update { it?.failed(BlockPhase.AnswerFailed) }
                    }
                }

                MutationResult.Obsolete -> {
                    run.update { it?.failed(BlockPhase.AnswerFailed) }
                }
            }
        }
    }

    fun timeUp(
        question: Question,
        seconds: Int,
    ) {
        run.update { it?.timeUp() }
        submit(question, Answer.DontKnow, minDurationMs = seconds * MILLIS_PER_SECOND)
    }

    fun next(questions: List<Question>) {
        shownAt = now()
        run.update { it?.next(questions) }
        if (run.value?.phase == BlockPhase.Finishing) finish()
    }

    /** From Finish on a fully answered block, or Try again after finishing failed. */
    fun finish() {
        run.update { it?.finishing() }
        viewModelScope.launch {
            when (val result = store.finish(key)) {
                is MutationResult.Done -> run.update { it?.finished(result.value) }
                is MutationResult.Failed -> run.update { it?.failed(BlockPhase.FinishFailed) }
                MutationResult.Obsolete -> Unit
            }
        }
    }

    /** "You already answered this question": read the block again and go on where it is. */
    fun reread() {
        viewModelScope.launch {
            block.refresh()
            val loaded = (block.state.value as? LoadState.Loaded)?.value ?: return@launch
            if (loaded.block.status != StudyBlock.Status.ACTIVE) {
                closing.value = true
                return@launch
            }
            run.value = BlockRun.begin(questions(loaded).questions)
            shownAt = now()
        }
    }

    /** The pause suggestion's Stop for today. */
    fun stopSession() {
        stopping.value = StopState.Stopping
        viewModelScope.launch {
            when (store.stop(key.sessionId)) {
                is MutationResult.Done -> closing.value = true
                is MutationResult.Failed -> stopping.value = StopState.Failed
                MutationResult.Obsolete -> stopping.value = StopState.Idle
            }
        }
    }

    enum class StopState { Idle, Stopping, Failed }

    private companion object {
        const val ALREADY_ANSWERED = "ALREADY_ANSWERED"
        const val BLOCK_NOT_ACTIVE = "BLOCK_NOT_ACTIVE"
        const val MILLIS_PER_SECOND = 1_000L
    }
}
