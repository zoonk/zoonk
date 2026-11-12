package com.zoonk.android.feature.practice.block

import android.os.SystemClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.focustest.FocusTestStore
import com.zoonk.android.feature.player.SessionMove
import com.zoonk.android.feature.player.SessionMover
import com.zoonk.android.feature.player.SessionSteps
import com.zoonk.android.feature.practice.AnswerSender
import com.zoonk.android.feature.practice.QuestionRun
import com.zoonk.android.feature.practice.RunControls
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.Submission
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.NotToday
import com.zoonk.android.feature.questions.Question
import com.zoonk.api.models.CheckpointQuestionsInner
import com.zoonk.api.models.FocusTestControlsInput
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockDetail
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
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
    steps: SessionSteps,
    private val focusTests: FocusTestStore,
    private val now: () -> Long = SystemClock::elapsedRealtime,
) : ViewModel(),
    RunControls {
    private val run = MutableStateFlow<QuestionRun?>(null)
    val state: StateFlow<QuestionRun?> = run.asStateFlow()

    private val closing = MutableStateFlow(false)

    /** The learner left, or the block isn't open anymore (finished elsewhere). */
    val closed: StateFlow<Boolean> = closing.asStateFlow()

    private var closeWhenFinished = false

    private val sessionMover = SessionMover(steps, key.sessionId, viewModelScope)
    val sessionMove: StateFlow<SessionMove> = sessionMover.move

    private var shownAt = now()
    private var read: BlockQuestions? = null
    private var sent: Submission? = null
    private var finishing: Job? = null

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
        if (questions.any { it.placement }) viewModelScope.launch { examGoal = focusTests.examGoal(key.sessionId) }
    }

    override fun startDrill() = run.update { it?.start() }

    override fun submit(
        question: Question,
        answer: Answer,
        sender: AnswerSender,
        minDurationMs: Long,
    ) {
        send(Submission.of(question, answer, sender, max(minDurationMs, now() - shownAt), unsaved = sent))
    }

    override fun retry() {
        sent?.let(::send)
    }

    private fun send(submission: Submission) {
        val current = run.value ?: return
        if (!current.canAnswer) return
        run.value = current.checking(submission.sender)
        sent = submission

        viewModelScope.launch {
            val answer = submission.answer
            when (val result = store.answer(key, submission.question.itemId, answer, submission.durationMs)) {
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

    override fun timeUp(
        question: Question,
        seconds: Int,
    ) {
        run.update { it?.timeUp() }
        submit(question, Answer.DontKnow, AnswerSender.Timer, seconds.seconds.inWholeMilliseconds)
    }

    override fun next(questions: List<Question>) {
        if (run.value?.phase == RunPhase.AlreadyAnswered) return reread()
        if (run.value?.phase !is RunPhase.Checked || sessionMove.value.busy) return
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
            val state = block.state.value
            if (state == LoadState.Failed(ApiError.NotFound)) {
                closing.value = true
                return@launch
            }
            val loaded = (state as? LoadState.Loaded)?.value ?: return@launch
            if (loaded.block.status != StudyBlock.Status.ACTIVE) {
                closing.value = true
                return@launch
            }
            run.value = QuestionRun.begin(questions(loaded).questions)
            shownAt = now()
        }
    }

    /** Only an exam's placement questions are its Focus test's, which "Not today" can skip. */
    private var examGoal by mutableStateOf<UUID?>(null)
    private var skipping = false
    private var skipFailed by mutableStateOf(false)

    override val notToday get() = examGoal?.let { NotToday(skipFailed) { skipTestQuestions(it) } }

    /** Today's test questions leave the session; the block read again goes on without them, or closes once it has none. */
    private fun skipTestQuestions(goalId: UUID) {
        if (skipping) return
        skipping = true
        skipFailed = false
        viewModelScope.launch {
            when (focusTests.setSessionQuestions(goalId, FocusTestControlsInput.SessionQuestions.SKIPPED_TODAY)) {
                is MutationResult.Done -> {
                    reread()
                }

                is MutationResult.Failed -> {
                    skipFailed = true
                }

                MutationResult.Obsolete -> {}
            }
            skipping = false
        }
    }

    fun continueSession() = sessionMover.continueSession()

    fun stopSession() = sessionMover.stop()

    private companion object {
        const val ALREADY_ANSWERED = "ALREADY_ANSWERED"
        const val BLOCK_NOT_ACTIVE = "BLOCK_NOT_ACTIVE"
    }
}
