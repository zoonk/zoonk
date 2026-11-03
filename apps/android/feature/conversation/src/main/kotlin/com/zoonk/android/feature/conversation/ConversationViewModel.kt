package com.zoonk.android.feature.conversation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ContentWritingWait
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.SessionSource
import com.zoonk.android.feature.livecall.CallSoFar
import com.zoonk.android.feature.livecall.LiveCall
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.livecall.LiveCallTask
import com.zoonk.android.feature.livecall.OngoingCalls
import com.zoonk.api.models.CompletedLanguageConversation
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.serializer
import java.util.UUID

/** How the call's save is going once it ended. */
enum class CallSave { Saving, Closing, Failed, Ended, TakenOver }

/**
 * One call attempt at a time (main's `LiveCallRun`): starting again leaves the last one, which the
 * server hangs up, and continues what it said. Leaving the screen does the same, so a call never
 * outlives its screen.
 */
class ConversationViewModel(
    private val conversationId: UUID,
    private val store: ConversationStore,
    private val newCall: (LiveCallTask, CallSoFar) -> LiveCall,
    private val ongoing: OngoingCalls,
    private val timeZone: () -> String,
    private val prep: PrepTimes,
    /** The app's: a call's save outlives its screen, so leaving while its feedback is written keeps the result. */
    private val scope: CoroutineScope,
) : ViewModel() {
    val conversation = store.conversation(conversationId)

    /** When the learner started preparing this task's card, on this device; null before. */
    val prepStartedAt: Flow<Long?> = prep.startedAt(conversationId)

    /** Another try being started; the screen opens it once started. */
    var startingAgain by mutableStateOf(false)
        private set

    var startAgainFailed by mutableStateOf(false)
        private set

    /** The run writing another try's card or mock, made with that try's kind. */
    var againWriting by mutableStateOf<ContentWritingWait?>(null)
        private set

    /** Null on the intro, before a start. */
    var call by mutableStateOf<LiveCall?>(null)
        private set

    /** Kept through a trip back to the intro: the server decides whether the next start continues it. */
    private var callSoFar = CallSoFar()

    var save by mutableStateOf<CallSave?>(null)
        private set

    /** The result just saved, with its ceremony and the day's moment; a call opened after it ended shows its stored result. */
    var completed by mutableStateOf<CompletedLanguageConversation?>(null)
        private set

    /** From the learner's tap, once the microphone was asked for. */
    fun start(
        conversation: LanguageConversation,
        microphone: Boolean,
        takeover: Boolean = false,
    ) {
        val left = call
        left?.leave()
        save = null
        viewModelScope.launch {
            // A dropped call's reconnect may still be reserving: the next start must name its connection.
            left?.let {
                it.settle()
                callSoFar = it.soFar
            }
            // Ended meanwhile, it's being saved under that connection: no other may start.
            if (call !== left || left?.state?.value?.phase == LiveCallPhase.Ended) return@launch
            val next = newCall(conversation.callTask, callSoFar)
            call = next
            next.start(microphone, takeover)
            // The notification's Hang up does what End does.
            ongoing.keep(next, conversation.character.name) {
                if (next.state.value.phase == LiveCallPhase.Connecting) cancel() else next.hangUp()
            }
            // A dropped call the learner then ends is saved too.
            next.state.first { it.phase == LiveCallPhase.Ended }
            if (call === next) scope.launch { save(next) }
        }
    }

    private var startedOnOpen = false

    /** The start a screen opened with, once: back from a later state, it doesn't call again. */
    fun startOnce(
        conversation: LanguageConversation,
        microphone: Boolean,
    ) {
        if (startedOnOpen) return
        startedOnOpen = true
        start(conversation, microphone)
    }

    /**
     * Ending a call that hasn't connected, or a refused microphone, goes back to the intro, unless a
     * dropped call is left to save: it stays dropped, to end or call again.
     */
    fun cancel() {
        val current = call
        if (current?.hasCallToSave == true) {
            current.leave()
            return
        }
        current?.let {
            callSoFar = it.soFar
            it.leave()
        }
        call = null
        save = null
    }

    fun startPrep() {
        viewModelScope.launch { prep.start(conversationId, System.currentTimeMillis()) }
    }

    /** Another try at a speaking mock or an exam task: a new conversation, from the learner's tap. */
    fun startAgain(
        request: CallRequest,
        onStarted: (UUID) -> Unit,
    ) {
        if (startingAgain) return
        startingAgain = true
        startAgainFailed = false
        val kind = if (request is CallRequest.SpeakingMock) GenerationKind.SpeakingMock else GenerationKind.ExamSpeaking
        val writing = againWriting ?: store.writingWaits.create(kind, viewModelScope).also { againWriting = it }
        viewModelScope.launch {
            val started = store.start(request)
            startingAgain = false
            when (writing.answered((started as? CallStart.Writing)?.generationId) { startAgain(request, onStarted) }) {
                ContentWritingWait.Answer.Waiting -> {
                    return@launch
                }

                ContentWritingWait.Answer.Failed -> {
                    startAgainFailed = true
                }

                ContentWritingWait.Answer.Proceed -> {
                    if (started is CallStart.Started) {
                        onStarted(started.conversationId)
                    } else {
                        startAgainFailed =
                            true
                    }
                }
            }
        }
    }

    fun saveAgain() {
        val current = call ?: return
        scope.launch { save(current) }
    }

    /** Nothing is saved, reviewed or rewarded until the server confirmed the call closed. */
    private suspend fun save(current: LiveCall) {
        save = CallSave.Saving
        val summary = current.finish()
        if (summary == null) {
            save = CallSave.Closing
            return
        }
        val input =
            LanguageConversationCompletionInput(
                summary.connectionId,
                summary.spokenSeconds,
                summary.turns,
                summary.usedHelp,
                timeZone(),
            )
        save =
            when (val completion = store.complete(conversationId, input)) {
                is CallCompletion.Completed -> {
                    completed = completion.conversation
                    null
                }

                CallCompletion.Ended -> {
                    CallSave.Ended
                }

                CallCompletion.TakenOver -> {
                    CallSave.TakenOver
                }

                CallCompletion.Failed -> {
                    CallSave.Failed
                }
            }
    }

    override fun onCleared() {
        call?.leave()
    }
}

val LanguageConversation.callTask: LiveCallTask
    get() =
        LiveCallTask(
            kind =
                when (kind) {
                    LanguageConversation.Kind.PRACTICE -> "practice"
                    LanguageConversation.Kind.CHECKPOINT -> "checkpoint"
                    LanguageConversation.Kind.SPEAKING_MOCK -> "speaking_mock"
                    LanguageConversation.Kind.EXAM_SPEAKING -> "exam_speaking"
                },
            objectives = objectives.map { it.label },
            met = objectives.filter { it.met }.map { it.label },
            talkSeconds = talkSeconds,
            examCues = examTask?.cues,
        )

/** The whole call's talk time; a connection after a drop gets what's left of it. */
internal val LanguageConversation.talkSeconds get() = minutes * 60

/** The preparation clock's start per card, kept on the device for the signed-in learner (main keeps it in device storage). */
interface PrepTimes {
    fun startedAt(card: UUID): Flow<Long?>

    suspend fun start(
        card: UUID,
        at: Long,
    )
}

/** A start older than this is a past attempt, not this one's preparation. */
private const val PREP_STALE_MS = 6 * 60 * 60 * 1000L

class DraftPrepTimes(
    private val drafts: DraftStore,
    private val sessions: SessionSource,
) : PrepTimes {
    override fun startedAt(card: UUID): Flow<Long?> =
        handle(card)?.value?.map { at -> at?.takeIf { System.currentTimeMillis() - it < PREP_STALE_MS } } ?: flowOf(null)

    override suspend fun start(
        card: UUID,
        at: Long,
    ) {
        handle(card)?.save(at)
    }

    private fun handle(card: UUID) = sessions.current?.let { drafts.open(it, "conversation.prep.$card", Long.serializer()) }
}
