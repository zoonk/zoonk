package com.zoonk.android.feature.testout

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.practice.AnswersDraft
import com.zoonk.android.feature.practice.GradedAnswer
import com.zoonk.android.feature.practice.resumableAnswers
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.ChapterTestOutRecord
import com.zoonk.api.models.ChapterTestOutResult
import com.zoonk.api.models.CreateChapterTestOutGeneration200Response
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.SubmitChapterTestOut200Response
import com.zoonk.api.models.TestOutGeneration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

/** A test-out's result; one opened again after it was sent celebrates nothing. */
@Immutable
data class TestOutOutcome(
    val passed: Boolean,
    val correct: Int,
    val total: Int,
    val skippedLessons: Int,
    /** For its Undo; null when nothing was skipped or the skip can't be undone anymore. */
    val changeId: UUID?,
    val ceremony: Milestone? = null,
    val reached: ReachedFacts? = null,
)

enum class UndoState { Idle, Pending, Done, Failed }

@Immutable
data class TestOutUi(
    val starting: Boolean = false,
    val writing: Boolean = false,
    val refused: Limit? = null,
    val plusRequired: Boolean = false,
    val startFailed: Boolean = false,
    /** Null until the answers kept on the device are read. */
    val answers: List<GradedAnswer>? = null,
    val sending: Boolean = false,
    val sendFailed: Boolean = false,
    val outcome: TestOutOutcome? = null,
    val celebrate: Boolean = false,
    val undo: UndoState = UndoState.Idle,
    val nothingToSkip: Boolean = false,
    /** The test the learner sent, until its result shows: reopened, the screen reads what it recorded. */
    val sent: String? = null,
)

/**
 * A chapter's test-out (main's `TestOutRun`): Start writes its questions, the answers stay on the
 * device until graded, and a sent test's id outlives the process, so reopening shows its result.
 */
class TestOutViewModel(
    private val key: TestOutKey,
    private val store: TestOutStore,
    private val plans: PlanStore,
    private val answersDraft: DraftHandle<AnswersDraft>?,
    generations: GenerationSource,
    private val saved: SavedStateHandle,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private val mutableUi = MutableStateFlow(TestOutUi(sent = saved[SENT]))
    val ui: StateFlow<TestOutUi> = mutableUi.asStateFlow()

    val testOut get() = store.testOuts[key]

    fun record(requestId: String) = store.records[RecordKey(key, UUID.fromString(requestId))]

    private val follower =
        GenerationFollower(
            kind = GenerationKind.TestOutQuestions,
            scope = viewModelScope,
            source = generations,
            restart = ::rewriteQuestions,
        )
    val run: StateFlow<GenerationRun> = follower.run
    val canRestart: Boolean get() = follower.canRestart

    private var requestId = UUID.randomUUID().toString()
    private var shownAt = now()

    fun start() {
        val ui = mutableUi.value
        if (ui.starting || ui.writing) return
        mutableUi.update { it.copy(starting = true, startFailed = false, refused = null) }
        viewModelScope.launch {
            when (val written = writeQuestions()) {
                is Written.Following -> follow(written.generationId)
                Written.Ready -> testOut.refresh().also { mutableUi.update { it.copy(starting = false) } }
                Written.Failed -> mutableUi.update { it.copy(starting = false, startFailed = true) }
                else -> stopWriting(written)
            }
        }
    }

    fun retryWriting() = follower.retry()

    /** The follower's restart: the new run's id, null once the questions are ready, or a throw when it didn't start. */
    private suspend fun rewriteQuestions(): String? =
        when (val written = writeQuestions()) {
            is Written.Following -> written.generationId
            Written.Ready -> null
            Written.Failed -> error("The questions weren't written")
            else -> null.also { stopWriting(written) }
        }

    private fun stopWriting(written: Written) {
        mutableUi.update {
            it.copy(
                starting = false,
                writing = false,
                nothingToSkip = written == Written.NothingToSkip,
                plusRequired = written == Written.PlusRequired,
                refused = (written as? Written.Refused)?.limit,
            )
        }
    }

    /** Starts the run once its questions show, from the answers kept on the device. */
    fun begin(questions: List<Question>) {
        if (mutableUi.value.answers != null) return
        viewModelScope.launch {
            val kept = answersDraft?.value?.first()
            val answers = resumableAnswers(kept?.answers.orEmpty(), questions.map { it.itemId }, questions.size)
            // A new attempt gets its own id: an old one could already have its grade on the server.
            if (answers.isNotEmpty()) kept?.requestId?.let { requestId = it }
            shownAt = now()
            mutableUi.update { it.copy(answers = answers) }
        }
    }

    fun answer(
        questions: List<Question>,
        question: Question,
        answer: Answer,
    ) {
        val ui = mutableUi.value
        val answers = ui.answers ?: return
        if (ui.sending || answers.any { it.itemId == question.itemId }) return
        val next = answers + GradedAnswer(question.itemId, answer, now() - shownAt)
        shownAt = now()
        mutableUi.update { it.copy(answers = next) }
        viewModelScope.launch { answersDraft?.save(AnswersDraft(requestId, next)) }
        if (next.size >= questions.size) send(next)
    }

    fun retrySend() {
        mutableUi.value.answers?.let(::send)
    }

    fun undo() {
        val changeId = mutableUi.value.outcome?.changeId ?: return
        if (mutableUi.value.undo == UndoState.Pending) return
        mutableUi.update { it.copy(undo = UndoState.Pending) }
        viewModelScope.launch {
            val undone = plans.undo(key.goalId, changeId)
            mutableUi.update { it.copy(undo = if (undone is MutationResult.Done) UndoState.Done else UndoState.Failed) }
        }
    }

    /** A recorded result read again after the process ended; one the server never got opens the test again. */
    fun showRecorded(read: LoadState<ChapterTestOutRecord>) {
        if (mutableUi.value.outcome != null) return
        when {
            read is LoadState.Loaded -> {
                val undo = if (read.value.undone) UndoState.Done else UndoState.Idle
                mutableUi.update { it.copy(outcome = read.value.outcome(), undo = undo) }
                viewModelScope.launch { answersDraft?.remove() }
            }

            read is LoadState.Failed && read.error == ApiError.NotFound -> {
                keepSent(null)
            }
        }
    }

    private fun send(answers: List<GradedAnswer>) {
        if (mutableUi.value.sending) return
        mutableUi.update { it.copy(sending = true, sendFailed = false) }
        keepSent(requestId)
        viewModelScope.launch {
            when (val result = store.submit(key, AnswersDraft(requestId, answers))) {
                is MutationResult.Done -> {
                    when (val graded = result.value) {
                        is SubmitChapterTestOut200Response.ChapterTestOutResultValue -> {
                            mutableUi.update { it.copy(sending = false, outcome = graded.value.outcome(), celebrate = true) }
                        }

                        is SubmitChapterTestOut200Response.NothingToSkipValue -> {
                            mutableUi.update { it.copy(sending = false, nothingToSkip = true) }
                        }
                    }
                    answersDraft?.remove()
                }

                is MutationResult.Failed -> {
                    keepSent(null)
                    mutableUi.update { it.copy(sending = false, sendFailed = true) }
                }

                MutationResult.Obsolete -> {
                    keepSent(null)
                    mutableUi.update { it.copy(sending = false) }
                }
            }
        }
    }

    private fun keepSent(requestId: String?) {
        saved[SENT] = requestId
        mutableUi.update { it.copy(sent = requestId) }
    }

    private fun follow(generationId: String) {
        mutableUi.update { it.copy(starting = false, writing = true) }
        follower.follow(generationId)
        viewModelScope.launch {
            follower.run.first { it.status == GenerationRun.Status.Ready }
            testOut.refresh()
            mutableUi.update { it.copy(writing = false) }
        }
    }

    private sealed interface Written {
        data class Following(
            val generationId: String,
        ) : Written

        data object Ready : Written

        data object NothingToSkip : Written

        data object PlusRequired : Written

        data class Refused(
            val limit: Limit,
        ) : Written

        data object Failed : Written
    }

    private suspend fun writeQuestions(): Written =
        when (val result = store.writeQuestions(key)) {
            is MutationResult.Done -> {
                when (val writing = result.value) {
                    is CreateChapterTestOutGeneration200Response.TestOutGenerationValue -> {
                        val generationId = writing.value.generationId
                        if (writing.value.status == TestOutGeneration.Status.GENERATING && generationId != null) {
                            Written.Following(generationId)
                        } else {
                            Written.Ready
                        }
                    }

                    is CreateChapterTestOutGeneration200Response.NothingToSkipValue -> {
                        Written.NothingToSkip
                    }
                }
            }

            is MutationResult.Failed -> {
                when {
                    result.code == PLUS_REQUIRED -> Written.PlusRequired
                    else -> Limit.of(result)?.let(Written::Refused) ?: Written.Failed
                }
            }

            MutationResult.Obsolete -> {
                Written.Failed
            }
        }

    private companion object {
        const val SENT = "sentRequestId"
        const val PLUS_REQUIRED = "PLUS_REQUIRED"
    }
}

private fun ChapterTestOutResult.outcome() =
    TestOutOutcome(
        passed = passed,
        correct = correct.toInt(),
        total = total.toInt(),
        skippedLessons = lessonsSkipped.toInt(),
        changeId = changeId,
        ceremony = ceremony,
        reached = ReachedFacts(reached.level, reached.energy),
    )

private fun ChapterTestOutRecord.outcome() =
    TestOutOutcome(
        passed = passed,
        correct = correct.toInt(),
        total = total.toInt(),
        skippedLessons = lessonsSkipped.toInt(),
        changeId = changeId?.takeIf { canUndo },
    )
