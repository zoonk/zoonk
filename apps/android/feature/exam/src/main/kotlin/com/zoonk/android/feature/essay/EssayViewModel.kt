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
import com.zoonk.api.models.WritingDraft
import com.zoonk.api.models.WritingResultOutput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

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
    /** Another device saved this answer since it was typed here: nothing saves until the learner picks one. */
    val conflict: WritingDraft? = null,
    /** The last save didn't reach the server; the text is kept on this device until one does. */
    val saveFailed: Boolean = false,
    /**
     * A grade the server had already recorded for this answer, before the learner changed it: the
     * changed text the grade isn't for, which a rewrite starts from.
     */
    val unsent: String? = null,
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
    val canSend: Boolean get() = text.isNotBlank() && send != WritingSend.Pending && conflict == null && !finished && !closed
}

/**
 * The text stays on this device as it's typed, under the admission it's written for, and goes to the
 * block's saved draft a moment later, so "Continue" works on another device. A save that finds a
 * newer draft from elsewhere stops and asks which to keep. Leaving, or the network coming back,
 * saves what isn't saved yet. Grading was admitted when writing started, so a send is never refused
 * for the day.
 */
class EssayViewModel(
    private val blockId: UUID,
    private val sessionId: UUID,
    private val store: EssayStore,
    private val kept: DraftHandle<KeptWriting>?,
    steps: SessionSteps,
    /** The app's: a save on leaving outlives this screen. */
    private val scope: CoroutineScope,
    networkAvailable: Flow<Unit> = emptyFlow(),
    private val clock: TimeSource = TimeSource.Monotonic,
) : ViewModel() {
    private val mutableUi = MutableStateFlow(EssayUi())
    val ui: StateFlow<EssayUi> = mutableUi.asStateFlow()

    val essay get() = store.essays[blockId]

    private val mover = SessionMover(steps, sessionId, viewModelScope)
    val move: StateFlow<SessionMove> = mover.move

    private var keptText: KeptWriting? = null
    private var keptRead = false
    private var essayRead: Essay? = null
    private var opening = false

    private var admission: UUID? = null

    /** The server's draft of [admission] as this device last knew it. */
    private var revision = 0L
    private var savedText = ""

    /** A save that's out, which the server may hold even if its answer never comes. */
    private var sendingText: String? = null
    private val saving = Mutex()
    private var saveSoon: Job? = null

    /** Active writing time: what's counted so far, and since when it's counting again. */
    private var writingMs = 0L
    private var writingSince: TimeMark? = null

    /** An answer whose grading never answered; the server may have graded it. */
    private var unanswered: String? = null
    private val sending = mutableMapOf<Pair<UUID, String>, Deferred<MutationResult<WritingResultOutput>>>()

    init {
        viewModelScope.launch {
            keptText = kept?.value?.first()
            keptRead = true
            open()
        }
        viewModelScope.launch { networkAvailable.collect { if (mutableUi.value.saveFailed) scope.launch { saveLatest() } } }
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

    /** The field stops at the API's longest answer, so what's typed can always be saved and graded. */
    fun write(text: String) {
        if (mutableUi.value.send == WritingSend.Pending || text.length > MAX_WRITING_CHARACTERS) return
        if (writingSince == null) writingSince = clock.markNow()
        mutableUi.update { it.copy(text = text) }
        keep()
        saveSoon?.cancel()
        saveSoon =
            viewModelScope.launch {
                delay(DRAFT_SAVE_DELAY)
                scope.launch { saveLatest() }
            }
    }

    /** "Keep this one": what's typed here goes over the other device's draft. */
    fun keepThis() {
        val other = mutableUi.value.conflict ?: return
        revision = other.revision
        savedText = other.text
        mutableUi.update { it.copy(conflict = null) }
        keep()
        scope.launch { saveLatest() }
    }

    /** "Use the other": the other device's draft replaces what's typed here. */
    fun useOther() {
        val other = mutableUi.value.conflict ?: return
        revision = other.revision
        savedText = other.text
        mutableUi.update { it.copy(conflict = null, saveFailed = false, text = other.text) }
        scope.launch { kept?.remove() }
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
            saveLatest()
            val earlier = unanswered
            val request = sending.getOrPut(admissionId to text) { submission(admissionId, text, writingDuration()) }
            when (val result = withTimeoutOrNull(GRADING_TIMEOUT) { request.await() }) {
                is MutationResult.Done -> {
                    unanswered = null
                    val recorded = if (earlier != null && earlier != text) recordedText(result.value) else null
                    if (recorded != null && recorded != text) replayed(recorded, text, result.value) else graded(text, result.value)
                }

                MutationResult.Obsolete -> {
                    mutableUi.update { it.copy(send = WritingSend.Idle) }
                }

                is MutationResult.Failed, null -> {
                    unanswered = text
                    mutableUi.update { it.copy(send = WritingSend.Failed) }
                }
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
                    writingMs = 0
                    writingSince = null
                    mutableUi.update { it.copy(rewriting = false, unsent = null, mode = WritingMode.Write, switched = true) }
                    write(ui.unsent ?: latest.text)
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

    /** Off screen, writing time stops until the next key, and what's typed reaches the disk and the saved draft now. */
    fun onStop() {
        pauseWriting()
        leave()
    }

    override fun onCleared() {
        pauseWriting()
        leave()
    }

    private fun leave() {
        saveSoon?.cancel()
        keep()
        scope.launch {
            kept?.flush()
            saveLatest()
        }
    }

    private fun open() {
        val essay = essayRead ?: return
        if (!keptRead || opening || mutableUi.value.results != null) return
        opening = true
        viewModelScope.launch {
            val draft = essay.draft
            // With no draft saved yet the block's start answers its admission again, so what's typed is kept under it from the first key.
            admission = draft?.admissionId ?: if (essay.closed) null else (admit() as? Admitted.Ready)?.admissionId
            revision = draft?.revision ?: 0
            savedText = draft?.text.orEmpty()
            val start = chooseDraft(keptText.takeUnless { essay.closed }, draft, admission?.toString())
            if (start is DraftStart.Kept) revision = start.base
            if (start !is DraftStart.Saved) writingMs = keptText?.writingMs ?: 0
            // A kept copy that's the saved draft, or another admission's, is gone, so it's never offered again; one
            // whose admission couldn't be asked stays for the next visit.
            if (start is DraftStart.Saved && keptText != null && admission != null) kept?.remove()
            val results = essay.drafts.map { GradedAnswer(it.grade, it.text, it.attemptId) }
            val graded = start is DraftStart.Saved && start.text.isBlank() && results.isNotEmpty()
            mutableUi.update {
                it.copy(
                    results = results,
                    text = start.text,
                    conflict = (start as? DraftStart.Conflict)?.saved,
                    mode = if (graded) WritingMode.Result else WritingMode.Question,
                    readClosed = essay.closed,
                )
            }
            if (start is DraftStart.Kept) scope.launch { saveLatest() }
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

    /** The device's copy of what's on screen, with the draft it was typed over; none once the server has it. */
    private fun keep() {
        val admissionId = admission ?: return
        val ui = mutableUi.value
        if (ui.results == null) return
        if (ui.text == savedText && sendingText == null && ui.conflict == null) {
            scope.launch { kept?.remove() }
            return
        }
        kept?.saveDebounced(KeptWriting(ui.text, revision, admissionId.toString(), sendingText, writingDuration()))
    }

    /**
     * Saves what's on screen until the server has it. Typing never cancels a save that's out, so
     * its answer always lands here; a draft from elsewhere stops saving until the learner picks.
     */
    private suspend fun saveLatest() {
        saving.withLock {
            while (true) {
                val ui = mutableUi.value
                val text = ui.text
                if (ui.results == null || ui.conflict != null) return
                if (text == savedText) return mutableUi.update { it.copy(saveFailed = false) }
                val admissionId = (admit() as? Admitted.Ready)?.admissionId ?: return
                sendingText = text
                keep()
                val result = store.saveDraft(blockId, SaveWritingDraft(admissionId, revision, text))
                sendingText = null
                mutableUi.update { it.copy(saveFailed = result is MutationResult.Failed) }
                when (val saved = (result as? MutationResult.Done)?.value) {
                    is DraftSave.Saved -> {
                        revision = saved.draft.revision
                        savedText = text
                        keep()
                        return
                    }

                    // This device's own save that landed without its answer, or the same text: nothing to choose.
                    is DraftSave.Conflict if saved.draft.text == text || saved.draft.text == savedText -> {
                        revision = saved.draft.revision
                        savedText = saved.draft.text
                    }

                    is DraftSave.Conflict -> {
                        mutableUi.update { it.copy(conflict = saved.draft) }
                        keep()
                        return
                    }

                    DraftSave.Closed, null -> {
                        keep()
                        return
                    }
                }
            }
        }
    }

    private fun pauseWriting() {
        writingSince?.let { writingMs += it.elapsedNow().inWholeMilliseconds }
        writingSince = null
    }

    /** Time on screen with the field, never what a device clock change or a day away adds. */
    private fun writingDuration(): Long = (writingMs + (writingSince?.elapsedNow()?.inWholeMilliseconds ?: 0)).coerceIn(0, MAX_DURATION_MS)

    private suspend fun attemptOf(answer: GradedAnswer): UUID? {
        essay.refresh()
        val read = (essay.state.value as? LoadState.Loaded)?.value ?: return null
        return read.drafts.firstOrNull { it.text == answer.text }?.attemptId
    }

    /** The text the server recorded with [grade], from the essay read after it. */
    private suspend fun recordedText(grade: WritingResultOutput): String? {
        essay.refresh()
        val read = (essay.state.value as? LoadState.Loaded)?.value ?: return null
        return read.drafts.firstOrNull { it.grade == grade }?.text
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
        closeAdmission()
        mutableUi.update { ui ->
            val results = ui.results.orEmpty()
            val known = results.firstOrNull()?.let { it.text == text && it.grade == grade } == true
            ui.copy(
                results = if (known) results else listOf(GradedAnswer(grade, text, null)) + results,
                send = WritingSend.Idle,
                saveFailed = false,
                text = "",
                mode = WritingMode.Result,
                switched = true,
            )
        }
        scope.launch { kept?.remove() }
    }

    /**
     * The first send was graded though its answer never came, so the server replayed that grade for
     * [recorded]: the result is that text's, and the changes the learner made since wait for a rewrite.
     */
    private fun replayed(
        recorded: String,
        changed: String,
        grade: WritingResultOutput,
    ) {
        closeAdmission()
        mutableUi.update { ui ->
            val results = ui.results.orEmpty().filter { it.text != recorded }
            ui.copy(
                results = listOf(GradedAnswer(grade, recorded, null)) + results,
                send = WritingSend.Idle,
                saveFailed = false,
                text = "",
                unsent = changed,
                mode = WritingMode.Result,
                switched = true,
            )
        }
        // The admission is spent, so a copy kept under it would only reopen as a draft it can't grade.
        scope.launch { kept?.remove() }
    }

    private fun closeAdmission() {
        admission = null
        writingMs = 0
        writingSince = null
        revision = 0
        savedText = ""
    }

    private companion object {
        /** The API's longest written answer, a written test's 210 minutes and then some. */
        const val MAX_DURATION_MS = 86_400_000L

        val DRAFT_SAVE_DELAY = 1500.milliseconds

        /** Grading a long answer takes up to a minute. */
        val GRADING_TIMEOUT = 120.seconds
    }
}
