package com.zoonk.android.feature.focustest

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.practice.GradedAnswer
import com.zoonk.android.feature.practice.UndoState
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FocusTestGeneration
import com.zoonk.api.models.FocusTestResult
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

@Immutable
data class AreaResult(
    val label: String,
    val answers: List<Boolean>,
    val chosen: Boolean,
)

@Immutable
data class FocusTestOutcome(
    val areas: List<AreaResult>,
    /** For its Undo; null when the focus was already this. */
    val changeId: UUID?,
    val ceremony: Milestone?,
    val reached: ReachedFacts,
)

@Immutable
data class FocusTestUi(
    val started: Boolean = false,
    val starting: Boolean = false,
    val writing: Boolean = false,
    val refused: Limit? = null,
    val startFailed: Boolean = false,
    /** The questions in the order they're asked: ones written later join the end. */
    val questions: List<Question> = emptyList(),
    val answers: List<GradedAnswer> = emptyList(),
    val sending: Boolean = false,
    val sendFailed: Boolean = false,
    val outcome: FocusTestOutcome? = null,
    /** False for an outcome brought back after the process ended: it was celebrated already. */
    val celebrate: Boolean = true,
    val undo: UndoState = UndoState.Idle,
)

class FocusTestViewModel(
    private val goalId: UUID,
    private val store: FocusTestStore,
    private val plans: PlanStore,
    generations: GenerationSource,
    private val answersDraft: DraftHandle<List<GradedAnswer>>?,
    private val saved: SavedStateHandle,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private val mutableUi =
        MutableStateFlow(
            FocusTestUi(
                started = saved[STARTED] ?: false,
                outcome = saved.get<String>(OUTCOME)?.let { ApiJson.decodeFromString(FocusTestResult.serializer(), it).outcome() },
                celebrate = saved.get<String>(OUTCOME) == null,
                undo = if (saved.get<Boolean>(UNDONE) == true) UndoState.Done else UndoState.Idle,
            ),
        )
    val ui: StateFlow<FocusTestUi> = mutableUi.asStateFlow()

    val test get() = store.tests[goalId]

    private val follower =
        GenerationFollower(
            kind = GenerationKind.FocusTestQuestions,
            scope = viewModelScope,
            source = generations,
            restart = ::rewriteQuestions,
        )
    private val written = MutableStateFlow(WrittenRead.Done)

    /** A run that's done still shows as following until its questions are read, as main's, so its end can't offer finishing short. */
    val run: StateFlow<GenerationRun> =
        combine(follower.run, written) { run, written ->
            when (written) {
                WrittenRead.Reading -> run.copy(status = GenerationRun.Status.Following)
                WrittenRead.Failed -> run.copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection)
                WrittenRead.Done -> run
            }
        }.stateIn(viewModelScope, SharingStarted.Eagerly, follower.run.value)
    val canRestart: Boolean get() = follower.canRestart

    private var total = 0
    private var shownAt = now()
    private var latest: List<Question> = emptyList()
    private var kept: List<GradedAnswer>? = null

    init {
        saved.get<String>(RUN)?.let(::follow)
        viewModelScope.launch {
            kept = answersDraft?.value?.first().orEmpty()
            place()
        }
    }

    fun arrive(read: FocusTestRead) {
        total = read.total
        latest = read.questions
        place()
    }

    fun start(read: FocusTestRead) {
        val ui = mutableUi.value
        if (ui.starting || ui.writing) return
        if (read.questions.size >= read.total) {
            begin()
            return
        }
        mutableUi.update { it.copy(starting = true, startFailed = false, refused = null) }
        viewModelScope.launch {
            when (val result = store.writeQuestions(goalId)) {
                is MutationResult.Done -> {
                    val generationId = result.value.followedId()
                    if (generationId != null) {
                        begin()
                        follow(generationId)
                    } else {
                        reread()
                        begin()
                    }
                }

                is MutationResult.Failed -> {
                    val limit = Limit.of(result)
                    mutableUi.update { it.copy(starting = false, refused = limit, startFailed = limit == null) }
                }

                MutationResult.Obsolete -> {
                    mutableUi.update { it.copy(starting = false) }
                }
            }
        }
    }

    fun retryWriting() {
        if (written.value == WrittenRead.Failed) viewModelScope.launch { readWritten() } else follower.retry()
    }

    fun answer(
        question: Question,
        answer: Answer,
    ) {
        val ui = mutableUi.value
        if (ui.sending || ui.answers.any { it.itemId == question.itemId }) return
        val next = ui.answers + GradedAnswer(question.itemId, answer, now() - shownAt)
        shownAt = now()
        mutableUi.update { it.copy(answers = next) }
        answersDraft?.saveDebounced(next)
        if (total > 0 && next.size >= total) send()
    }

    /** After a failed send, or with the answers given once the rest won't be written. */
    fun send() {
        val ui = mutableUi.value
        if (ui.sending || ui.answers.isEmpty()) return
        mutableUi.update { it.copy(sending = true, sendFailed = false) }
        viewModelScope.launch {
            when (val result = store.submit(goalId, ui.answers)) {
                is MutationResult.Done -> {
                    saved[OUTCOME] = ApiJson.encodeToString(FocusTestResult.serializer(), result.value)
                    mutableUi.update { it.copy(sending = false, outcome = result.value.outcome()) }
                    answersDraft?.remove()
                }

                is MutationResult.Failed -> {
                    mutableUi.update { it.copy(sending = false, sendFailed = true) }
                }

                MutationResult.Obsolete -> {
                    mutableUi.update { it.copy(sending = false) }
                }
            }
        }
    }

    fun onStop() {
        viewModelScope.launch { answersDraft?.flush() }
    }

    fun undo() {
        val changeId = mutableUi.value.outcome?.changeId ?: return
        if (mutableUi.value.undo == UndoState.Pending) return
        mutableUi.update { it.copy(undo = UndoState.Pending) }
        viewModelScope.launch {
            val undone = plans.undo(goalId, changeId) is MutationResult.Done
            if (undone) saved[UNDONE] = true
            mutableUi.update { it.copy(undo = if (undone) UndoState.Done else UndoState.Failed) }
        }
    }

    /**
     * Answers kept on the device come back first, short of the last question so the test still ends
     * on the learner's own answer; questions written meanwhile join the end, so answered ones stay put.
     */
    private fun place() {
        val kept = kept ?: return
        val ui = mutableUi.value
        if (ui.questions.isEmpty()) {
            val byId = latest.associateBy { it.itemId }
            val answers = kept.takeWhile { it.itemId in byId }.take(maxOf(0, total - 1))
            val answered = answers.map { it.itemId }.toSet()
            if (latest.isNotEmpty()) shownAt = now()
            mutableUi.update {
                it.copy(
                    questions =
                        answers.map { answer ->
                            byId.getValue(answer.itemId)
                        } + latest.filter { q -> q.itemId !in answered },
                    answers = answers,
                )
            }
            return
        }
        val known = ui.questions.map { it.itemId }.toSet()
        val added = latest.filter { it.itemId !in known }
        if (added.isEmpty()) return
        if (ui.answers.size >= ui.questions.size) shownAt = now()
        mutableUi.update { it.copy(questions = it.questions + added) }
    }

    private fun begin() {
        saved[STARTED] = true
        shownAt = now()
        mutableUi.update { it.copy(started = true, starting = false) }
    }

    private fun follow(generationId: String) {
        saved[RUN] = generationId
        mutableUi.update { it.copy(writing = true) }
        follower.follow(generationId)
        awaitWritten()
    }

    private fun awaitWritten() {
        viewModelScope.launch {
            follower.run.first { it.status == GenerationRun.Status.Ready }
            saved.remove<String>(RUN)
            readWritten()
        }
    }

    private suspend fun readWritten() {
        written.value = WrittenRead.Reading
        written.value = if (reread()) WrittenRead.Done else WrittenRead.Failed
    }

    /** A fresh read: one already in flight could be from before the questions were written. */
    private suspend fun reread(): Boolean {
        val before = test.revision
        test.invalidate()
        test.refresh()
        val read = (test.state.value as? LoadState.Loaded)?.value
        // A refresh that fails keeps what's shown, so an unchanged revision is how a failure shows.
        if (read == null || test.revision == before) return false
        arrive(read)
        return true
    }

    private suspend fun rewriteQuestions(): String? =
        when (val result = store.writeQuestions(goalId)) {
            is MutationResult.Done -> {
                result.value.followedId().also { saved[RUN] = it }
            }

            is MutationResult.Failed -> {
                val limit = Limit.of(result) ?: error("The questions weren't written")
                stopWriting(limit)
                null
            }

            MutationResult.Obsolete -> {
                error("The questions weren't written")
            }
        }

    /** A refused rewrite ends the writing; with nothing to answer yet, the test goes back to its start, which shows why. */
    private fun stopWriting(limit: Limit) {
        saved.remove<String>(RUN)
        val nothingToAnswer = mutableUi.value.questions.isEmpty()
        if (nothingToAnswer) saved[STARTED] = false
        mutableUi.update { it.copy(writing = false, refused = limit, started = it.started && !nothingToAnswer) }
    }

    private companion object {
        const val STARTED = "started"
        const val RUN = "run"
        const val OUTCOME = "outcome"
        const val UNDONE = "undone"
    }
}

private enum class WrittenRead { Reading, Failed, Done }

private fun FocusTestGeneration.followedId() = generationId.takeIf { status == FocusTestGeneration.Status.GENERATING }

private fun FocusTestResult.outcome() =
    FocusTestOutcome(
        areas = areas.map { AreaResult(it.label, it.answers, it.chosen) },
        changeId = changeId,
        ceremony = ceremony,
        reached = ReachedFacts(reached.level, reached.energy),
    )
