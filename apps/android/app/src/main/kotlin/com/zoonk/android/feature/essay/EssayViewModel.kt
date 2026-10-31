package com.zoonk.android.feature.essay

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.player.SessionMove
import com.zoonk.android.feature.player.SessionMover
import com.zoonk.android.feature.player.SessionSteps
import com.zoonk.android.feature.player.language.countWords
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssayDraftsInner
import com.zoonk.api.models.EssayGrade
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.time.Clock
import kotlin.time.Duration.Companion.seconds

/** The box's text, and the draft being graded with its attempt, so sending it again after the process ends is graded once. */
@Serializable
data class UnsentEssay(
    val text: String,
    val attemptId: String? = null,
    val sent: String? = null,
)

private val Essay.closed get() = status == Essay.Status.COMPLETED || status == Essay.Status.SKIPPED

enum class EssayMode { Grade, Write }

enum class EssaySend { Idle, Pending, Failed, LimitReached, DailyLimitReached }

@Immutable
data class EssayUi(
    /** The essay's, newest first; null until it and the text kept on the device are both in. */
    val drafts: List<EssayDraftsInner>? = null,
    val gradesLeft: Int = 0,
    val mode: EssayMode = EssayMode.Write,
    val text: String = "",
    val send: EssaySend = EssaySend.Idle,
    val finishing: Boolean = false,
    val finishFailed: Boolean = false,
    /** The block is done, so only going on is left. */
    val finished: Boolean = false,
    /** The essay's latest read says it was completed or skipped. */
    val readClosed: Boolean = false,
    /** The learner went between the grade and the box, so TalkBack follows where they went. */
    val switched: Boolean = false,
) {
    val graded: String get() = drafts?.firstOrNull()?.text.orEmpty()
    val grade: EssayGrade? get() = drafts?.firstOrNull()?.grade
    val words: Int get() = countWords(text)
    val unsent: Boolean get() = text.isNotBlank() && text != graded

    /** It shows what it is and takes no draft; a block finished in this visit goes on to the session instead. */
    val closed: Boolean get() = readClosed && !finishing && !finished
    val canSend: Boolean get() = words > 0 && send != EssaySend.Pending && gradesLeft > 0 && !finished && !closed
}

class EssayViewModel(
    private val blockId: UUID,
    private val sessionId: UUID,
    private val store: EssayStore,
    private val unsent: DraftHandle<UnsentEssay>?,
    steps: SessionSteps,
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : ViewModel() {
    private val mutableUi = MutableStateFlow(EssayUi())
    val ui: StateFlow<EssayUi> = mutableUi.asStateFlow()

    val essay get() = store.essays[blockId]

    private val mover = SessionMover(steps, sessionId, viewModelScope)
    val move: StateFlow<SessionMove> = mover.move

    private var kept: UnsentEssay? = null
    private var keptRead = false
    private var essayRead: Essay? = null
    private var startedAt: Long? = null
    private var editedSinceSentAt: Long? = null
    private var ungraded: Ungraded? = null
    private val sending = mutableMapOf<UUID, Deferred<MutationResult<EssayGrade>>>()

    init {
        viewModelScope.launch {
            kept = unsent?.value?.first()
            ungraded = kept?.let { draft -> draft.attemptId?.let { Ungraded(UUID.fromString(it), draft.sent ?: draft.text) } }
            keptRead = true
            open()
        }
    }

    /** Each read of the essay, its drafts and today's grades left; the first one opens it. */
    fun arrive(essay: Essay) {
        essayRead = essay
        if (mutableUi.value.drafts == null) {
            open()
        } else {
            mutableUi.update { it.copy(drafts = essay.drafts, gradesLeft = essay.gradesLeft.toInt(), readClosed = essay.closed) }
        }
    }

    fun write(text: String) {
        val time = now()
        if (startedAt == null) startedAt = time
        if (editedSinceSentAt == null) editedSinceSentAt = time
        mutableUi.update { it.copy(text = text) }
        unsent?.saveDebounced(UnsentEssay(text, ungraded?.attemptId?.toString(), ungraded?.text))
    }

    /** A grade that lands after the wait gave up still shows, and the same draft sent again joins its request. */
    fun send() {
        val ui = mutableUi.value
        if (!ui.canSend) return
        val text = ui.text
        val durationMs = startedAt?.let { minOf(now() - it, MAX_DURATION_MS) } ?: 0
        val attemptId = ungraded?.takeIf { it.text == text }?.attemptId ?: UUID.randomUUID()
        ungraded = Ungraded(attemptId, text)
        editedSinceSentAt = null
        unsent?.saveDebounced(UnsentEssay(text, attemptId.toString(), text))
        mutableUi.update { it.copy(send = EssaySend.Pending) }

        val request = sending.getOrPut(attemptId) { submission(attemptId, text, durationMs) }
        viewModelScope.launch {
            val giveUp =
                launch {
                    delay(GRADING_TIMEOUT)
                    mutableUi.update { if (it.send == EssaySend.Pending) it.copy(send = EssaySend.Failed) else it }
                }
            val result = request.await()
            giveUp.cancel()
            if (ungraded?.attemptId != attemptId) return@launch
            when (result) {
                is MutationResult.Done -> {
                    graded(text, result.value)
                }

                is MutationResult.Failed -> {
                    val send =
                        when (result.code) {
                            ESSAY_LIMIT_REACHED -> EssaySend.LimitReached
                            DAILY_LIMIT_REACHED -> EssaySend.DailyLimitReached
                            else -> EssaySend.Failed
                        }
                    mutableUi.update { it.copy(send = send) }
                    if (result.code == BLOCK_NOT_ACTIVE) essay.refresh()
                }

                MutationResult.Obsolete -> {
                    mutableUi.update { it.copy(send = EssaySend.Idle) }
                }
            }
        }
    }

    fun rewrite() {
        val ui = mutableUi.value
        if (!ui.finished && !ui.closed) mutableUi.update { it.copy(mode = EssayMode.Write, switched = true) }
    }

    fun seeGrade() = mutableUi.update { it.copy(mode = EssayMode.Grade, switched = true) }

    /** Every draft still being graded is recorded first, so the block counts it. */
    fun finish() {
        if (mutableUi.value.finishing || move.value.busy) return
        mutableUi.update { it.copy(finishing = true, finishFailed = false) }
        viewModelScope.launch {
            sending.values.toList().awaitAll()
            val finished = mutableUi.value.finished || store.finish(sessionId, blockId) is MutationResult.Done
            mutableUi.update { it.copy(finishing = false, finishFailed = !finished, finished = finished) }
            if (finished) mover.continueSession()
        }
    }

    fun onStop() {
        viewModelScope.launch { unsent?.flush() }
    }

    private fun open() {
        val essay = essayRead ?: return
        if (!keptRead || mutableUi.value.drafts != null) return
        val graded =
            essay.drafts
                .firstOrNull()
                ?.text
                .orEmpty()
        val text = kept?.text?.takeIf { it.isNotBlank() && it != graded } ?: graded
        mutableUi.update {
            it.copy(
                drafts = essay.drafts,
                gradesLeft = essay.gradesLeft.toInt(),
                text = text,
                mode = if (essay.drafts.isEmpty()) EssayMode.Write else EssayMode.Grade,
                readClosed = essay.closed,
            )
        }
    }

    private fun submission(
        attemptId: UUID,
        text: String,
        durationMs: Long,
    ): Deferred<MutationResult<EssayGrade>> =
        viewModelScope.async { store.submit(blockId, attemptId, text, durationMs).also { sending.remove(attemptId) } }

    /** The box keeps text typed while it was graded, as the rewrite; otherwise the grade shows and nothing is left unsent. */
    private fun graded(
        text: String,
        grade: EssayGrade,
    ) {
        val editedSince = mutableUi.value.text != text
        ungraded = null
        startedAt = if (editedSince) editedSinceSentAt else null
        mutableUi.update { ui ->
            val drafts = ui.drafts.orEmpty()
            val known = drafts.firstOrNull()?.grade == grade
            ui.copy(
                drafts = if (known) drafts else listOf(EssayDraftsInner(grade, Clock.System.now(), text)) + drafts,
                gradesLeft = if (known) ui.gradesLeft else maxOf(0, ui.gradesLeft - 1),
                send = EssaySend.Idle,
                mode = if (editedSince) ui.mode else EssayMode.Grade,
                switched = ui.switched || !editedSince,
            )
        }
        if (editedSince) {
            unsent?.saveDebounced(UnsentEssay(mutableUi.value.text))
        } else {
            viewModelScope.launch { unsent?.remove() }
        }
    }

    private data class Ungraded(
        val attemptId: UUID,
        val text: String,
    )

    private companion object {
        const val ESSAY_LIMIT_REACHED = "ESSAY_LIMIT_REACHED"
        const val DAILY_LIMIT_REACHED = "DAILY_LIMIT_REACHED"
        const val BLOCK_NOT_ACTIVE = "BLOCK_NOT_ACTIVE"

        /** The API's longest essay duration. */
        const val MAX_DURATION_MS = 5_400_000L

        /** Grading takes about 9 to 17 s, and up to 24 s on the fallback model. */
        val GRADING_TIMEOUT = 90.seconds
    }
}
