package com.zoonk.android.feature.essay

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.player.SessionMove
import com.zoonk.android.feature.player.SessionMover
import com.zoonk.android.feature.player.SessionSteps
import com.zoonk.api.models.Essay
import com.zoonk.api.models.SaveWritingDraft
import com.zoonk.api.models.WritingResultOutput
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import kotlin.time.Clock
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

private val Essay.closed get() = status == Essay.Status.COMPLETED || status == Essay.Status.SKIPPED

/** Read the question, write, read the grade, or the day's extra grades are used for a rewrite. */
enum class WritingMode { Question, Write, Result, Refused }

enum class WritingSend { Idle, Pending, Failed, SignUpRequired }

/** A graded answer; [attemptId] is null until the essay is read again after its grade came in. */
@Immutable
data class GradedAnswer(
    val grade: WritingResultOutput,
    val text: String,
    val attemptId: UUID?,
)

@Immutable
data class EssayUi(
    /** The essay's graded answers, newest first; null until it and the text kept on the device are both in. */
    val results: List<GradedAnswer>? = null,
    val mode: WritingMode = WritingMode.Question,
    val text: String = "",
    val send: WritingSend = WritingSend.Idle,
    /** A rewrite's start is out. */
    val rewriting: Boolean = false,
    val rewriteFailed: Boolean = false,
    val finishing: Boolean = false,
    val finishFailures: Int = 0,
    /** The block is done, so only going on is left. */
    val finished: Boolean = false,
    /** The essay's latest read says it was completed or skipped. */
    val readClosed: Boolean = false,
    /** The learner moved between screens, so TalkBack follows where they went. */
    val switched: Boolean = false,
) {
    val latest: GradedAnswer? get() = results?.firstOrNull()

    /** It shows what it is and takes no answer; a block finished in this visit goes on to the session instead. */
    val closed: Boolean get() = readClosed && !finishing && !finished
    val canSend: Boolean get() = text.isNotBlank() && send != WritingSend.Pending && !finished && !closed
}

/**
 * The text stays on this device as it's typed and goes to the block's saved draft a moment later,
 * so "Continue" works on another device. A save that finds a newer draft keeps what was typed here
 * and saves it over that one, once. Grading was admitted when writing started, so a send is never
 * refused for the day.
 */
class EssayViewModel(
    private val blockId: UUID,
    private val sessionId: UUID,
    private val store: EssayStore,
    private val kept: DraftHandle<KeptWriting>?,
    steps: SessionSteps,
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : ViewModel() {
    private val mutableUi = MutableStateFlow(EssayUi())
    val ui: StateFlow<EssayUi> = mutableUi.asStateFlow()

    val essay get() = store.essays[blockId]

    private val mover = SessionMover(steps, sessionId, viewModelScope)
    val move: StateFlow<SessionMove> = mover.move

    private var keptText: KeptWriting? = null
    private var keptRead = false
    private var essayRead: Essay? = null

    private var admission: UUID? = null
    private var revision = 0L
    private var savedText = ""
    private val saving = Mutex()
    private var saveSoon: Job? = null

    private var startedAt: Long? = null
    private val sending = mutableMapOf<Pair<UUID, String>, Deferred<MutationResult<WritingResultOutput>>>()

    init {
        viewModelScope.launch {
            keptText = kept?.value?.first()
            keptRead = true
            open()
        }
    }

    /** Each read of the essay; the first one opens it. */
    fun arrive(essay: Essay) {
        essayRead = essay
        if (mutableUi.value.results == null) {
            open()
            return
        }
        mutableUi.update { ui ->
            val read = essay.drafts.map { GradedAnswer(it.grade, it.text, it.attemptId) }
            // A grade that came in before this read keeps its place until the read lists it.
            val pending = ui.latest?.takeIf { it.attemptId == null && read.none { answer -> answer.text == it.text } }
            ui.copy(results = listOfNotNull(pending) + read, readClosed = essay.closed)
        }
    }

    /** From the question: the field, with what was kept. */
    fun startWriting() = mutableUi.update { it.copy(mode = WritingMode.Write, switched = true) }

    fun seeQuestion() = mutableUi.update { it.copy(mode = WritingMode.Question, switched = true) }

    fun write(text: String) {
        if (mutableUi.value.send == WritingSend.Pending) return
        if (startedAt == null) startedAt = now()
        mutableUi.update { it.copy(text = text) }
        kept?.saveDebounced(KeptWriting(text, revision))
        saveSoon?.cancel()
        saveSoon =
            viewModelScope.launch {
                delay(DRAFT_SAVE_DELAY)
                save(text)
            }
    }

    /** The same answer sent again while its earlier send is out joins that request. */
    fun send() {
        val ui = mutableUi.value
        if (!ui.canSend) return
        val text = ui.text
        mutableUi.update { it.copy(send = WritingSend.Pending) }

        viewModelScope.launch {
            val admissionId =
                when (val started = admit()) {
                    is Admitted.Ready -> started.admissionId
                    Admitted.SignUpRequired -> return@launch mutableUi.update { it.copy(send = WritingSend.SignUpRequired) }
                    Admitted.Failed -> return@launch mutableUi.update { it.copy(send = WritingSend.Failed) }
                }
            saveSoon?.cancel()
            save(text)
            val durationMs = startedAt?.let { minOf(now() - it, MAX_DURATION_MS) } ?: 0
            val request = sending.getOrPut(admissionId to text) { submission(admissionId, text, durationMs) }
            when (val result = withTimeoutOrNull(GRADING_TIMEOUT) { request.await() }) {
                is MutationResult.Done -> graded(text, result.value)
                MutationResult.Obsolete -> mutableUi.update { it.copy(send = WritingSend.Idle) }
                is MutationResult.Failed, null -> mutableUi.update { it.copy(send = WritingSend.Failed) }
            }
        }
    }

    /** A tap on Rewrite is a start: the grading is admitted here, or refused before anything is written. */
    fun rewrite() {
        val ui = mutableUi.value
        val latest = ui.latest ?: return
        if (ui.rewriting || ui.finished || ui.closed) return
        mutableUi.update { it.copy(rewriting = true, rewriteFailed = false) }

        viewModelScope.launch {
            val attemptId = latest.attemptId ?: attemptOf(latest)
            val started = attemptId?.let { store.start(blockId, it) }
            when (val answer = (started as? MutationResult.Done)?.value) {
                is WritingStartAnswer.Ready -> {
                    admission = answer.admissionId
                    revision = 0
                    savedText = ""
                    startedAt = null
                    mutableUi.update { it.copy(rewriting = false, mode = WritingMode.Write, switched = true) }
                    write(latest.text)
                }

                is WritingStartAnswer.LimitReached -> {
                    mutableUi.update { it.copy(rewriting = false, mode = WritingMode.Refused, switched = true) }
                }

                else -> {
                    mutableUi.update { it.copy(rewriting = false, rewriteFailed = started !is MutationResult.Obsolete) }
                }
            }
        }
    }

    /** Every answer still being graded is recorded first, so the block counts it. */
    fun finish() {
        if (mutableUi.value.finishing || move.value.busy) return
        mutableUi.update { it.copy(finishing = true) }
        viewModelScope.launch {
            sending.values.toList().awaitAll()
            val finished = mutableUi.value.finished || store.finish(sessionId, blockId) is MutationResult.Done
            mutableUi.update {
                it.copy(
                    finishing = false,
                    finishFailures = if (finished) 0 else it.finishFailures + 1,
                    finished = finished,
                )
            }
            if (finished) mover.continueSession()
        }
    }

    /** Off screen, what's typed reaches the disk and the saved draft now. */
    fun onStop() {
        viewModelScope.launch {
            kept?.flush()
            if (saveSoon?.isActive == true) {
                saveSoon?.cancel()
                save(mutableUi.value.text)
            }
        }
    }

    private fun open() {
        val essay = essayRead ?: return
        if (!keptRead || mutableUi.value.results != null) return
        val draft = essay.draft
        admission = draft?.admissionId
        revision = draft?.revision ?: 0
        savedText = draft?.text.orEmpty()
        val text = chooseDraftText(keptText, draft?.text, draft?.revision)
        val results = essay.drafts.map { GradedAnswer(it.grade, it.text, it.attemptId) }
        mutableUi.update {
            it.copy(
                results = results,
                text = text,
                mode = if (text.isBlank() && results.isNotEmpty()) WritingMode.Result else WritingMode.Question,
                readClosed = essay.closed,
            )
        }
    }

    private sealed interface Admitted {
        data class Ready(
            val admissionId: UUID,
        ) : Admitted

        data object SignUpRequired : Admitted

        data object Failed : Admitted
    }

    /** The block's start, replayed: the essay is read only after one, so this admits what's already admitted. */
    private suspend fun admit(): Admitted {
        admission?.let { return Admitted.Ready(it) }
        return when (val answer = (store.start(blockId) as? MutationResult.Done)?.value) {
            is WritingStartAnswer.Ready -> Admitted.Ready(answer.admissionId).also { admission = answer.admissionId }
            WritingStartAnswer.SignUpRequired -> Admitted.SignUpRequired
            else -> Admitted.Failed
        }
    }

    private suspend fun save(text: String) {
        saving.withLock {
            if (text == savedText) return
            val admissionId = (admit() as? Admitted.Ready)?.admissionId ?: return
            var retried = false
            while (true) {
                val saved = (store.saveDraft(blockId, SaveWritingDraft(admissionId, revision, text)) as? MutationResult.Done)?.value
                when (saved) {
                    is DraftSave.Saved -> {
                        revision = saved.draft.revision
                        savedText = text
                        if (mutableUi.value.text == text) kept?.saveDebounced(KeptWriting(text, revision))
                        return
                    }

                    // Another device saved first: what was typed here goes over it, once.
                    is DraftSave.Conflict -> {
                        revision = saved.draft.revision
                        if (retried) return
                        retried = true
                    }

                    DraftSave.Closed, null -> {
                        return
                    }
                }
            }
        }
    }

    private suspend fun attemptOf(answer: GradedAnswer): UUID? {
        essay.refresh()
        val read = (essay.state.value as? LoadState.Loaded)?.value ?: return null
        return read.drafts.firstOrNull { it.text == answer.text }?.attemptId
    }

    private fun submission(
        admissionId: UUID,
        text: String,
        durationMs: Long,
    ): Deferred<MutationResult<WritingResultOutput>> =
        viewModelScope.async { store.submit(blockId, admissionId, text, durationMs).also { sending.remove(admissionId to text) } }

    /** The field is read-only while it's graded, so the grade shows and nothing is left unsent. */
    private fun graded(
        text: String,
        grade: WritingResultOutput,
    ) {
        admission = null
        startedAt = null
        savedText = ""
        mutableUi.update { ui ->
            val results = ui.results.orEmpty()
            val known = results.firstOrNull()?.let { it.text == text && it.grade == grade } == true
            ui.copy(
                results = if (known) results else listOf(GradedAnswer(grade, text, null)) + results,
                send = WritingSend.Idle,
                text = "",
                mode = WritingMode.Result,
                switched = true,
            )
        }
        viewModelScope.launch { kept?.remove() }
    }

    private companion object {
        /** The API's longest written answer, a written test's 210 minutes and then some. */
        const val MAX_DURATION_MS = 86_400_000L

        val DRAFT_SAVE_DELAY = 1500.milliseconds

        /** Grading a long answer takes up to a minute. */
        val GRADING_TIMEOUT = 120.seconds
    }
}
