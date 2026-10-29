package com.zoonk.android.feature.practice.block

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.practice.QuestionRun
import com.zoonk.android.feature.practice.RunControls
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Question
import com.zoonk.api.models.CheckpointQuestionsInner
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockDetail
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.time.Duration.Companion.seconds

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
) : ViewModel(),
    RunControls {
    private val run = MutableStateFlow<QuestionRun?>(null)
    val state: StateFlow<QuestionRun?> = run.asStateFlow()

    private val closing = MutableStateFlow(false)

    /** The learner left, the block isn't open anymore (finished elsewhere) or the session stopped. */
    val closed: StateFlow<Boolean> = closing.asStateFlow()

    private var closeWhenFinished = false

    private val stopping = MutableStateFlow<StopState>(StopState.Idle)
    val stop: StateFlow<StopState> = stopping.asStateFlow()

    private var shownAt = now()
    private var read: BlockQuestions? = null
    private var sent: Submission? = null
    private var finishing: Job? = null

    /** What the last answer sent, so Try again sends the same (a timed drill's "not sure" included). */
    private data class Submission(
        val question: Question,
        val answer: Answer,
        val minDurationMs: Long,
    )

    override val canRetry: Boolean get() = sent != null

    val block get() = store.blocks[key]

    fun questions(detail: StudyBlockDetail): BlockQuestions =
        read?.takeIf { it.detail === detail }
            ?: BlockQuestions(detail, detail.questions.map { it.recode<CheckpointQuestionsInner, Question>() }).also { read = it }

    /** Starts the run once its questions first show; later reads of the block keep it. */
    fun begin(questions: List<Question>) {
        if (run.value != null) return
        run.value = QuestionRun.begin(questions)
        shownAt = now()
    }

    override fun startDrill(questions: List<Question>) = run.update { it?.start(questions) }

    override fun reveal() = run.update { it?.reveal() }

    override fun submit(
        question: Question,
        answer: Answer,
        minDurationMs: Long,
    ) {
        val current = run.value ?: return
        if (!current.canAnswer) return
        run.value = current.checking()
        sent = Submission(question, answer, minDurationMs)

        viewModelScope.launch {
            val duration = max(minDurationMs, now() - shownAt)
            when (val result = store.answer(key, question.itemId, answer, duration)) {
                is MutationResult.Done -> {
                    sent = null
                    run.update { it?.answered(answer, result.value.recode<StudyAnswerFeedback, AnswerFeedback>()) }
                }

                is MutationResult.Failed -> {
                    when (result.code) {
                        ALREADY_ANSWERED -> run.update { it?.failed(RunPhase.AlreadyAnswered) }
                        BLOCK_NOT_ACTIVE -> reread()
                        else -> run.update { it?.failed(RunPhase.AnswerFailed) }
                    }
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

    override fun retry() {
        sent?.let { submit(it.question, it.answer, it.minDurationMs) }
    }

    override fun timeUp(
        question: Question,
        seconds: Int,
    ) {
        run.update { it?.timeUp() }
        submit(question, Answer.DontKnow, minDurationMs = seconds.seconds.inWholeMilliseconds)
    }

    override fun next(questions: List<Question>) {
        if (run.value?.phase !is RunPhase.Checked) return
        shownAt = now()
        run.update { it?.next(questions) }
        if (run.value?.phase == RunPhase.Finishing) finish()
    }

    /** From Finish on a fully answered block, or Try again after finishing failed. */
    fun finish() {
        if (finishing?.isActive == true) return
        run.update { it?.finishing() }
        finishing =
            viewModelScope.launch {
                when (val result = store.finish(key)) {
                    is MutationResult.Done -> run.update { it?.finished(result.value) }
                    is MutationResult.Failed -> run.update { it?.failed(RunPhase.FinishFailed) }
                    MutationResult.Obsolete -> Unit
                }
                if (closeWhenFinished) closing.value = true
            }
    }

    /** Leaving while the block finishes waits for it: leaving the screen would cancel the save. */
    fun close() {
        if (finishing?.isActive == true) closeWhenFinished = true else closing.value = true
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
            run.value = QuestionRun.begin(questions(loaded).questions)
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
    }
}
