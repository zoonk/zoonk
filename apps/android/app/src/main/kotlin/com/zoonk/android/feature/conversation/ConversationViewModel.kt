package com.zoonk.android.feature.conversation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.SessionSource
import com.zoonk.android.feature.livecall.LiveCall
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.livecall.LiveCallScript
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
 * server hangs up. Leaving the screen does the same, so a call never outlives its screen.
 */
class ConversationViewModel(
    private val conversationId: UUID,
    private val store: ConversationStore,
    private val newCall: (LiveCallScript) -> LiveCall,
    private val ongoing: OngoingCalls,
    private val timeZone: () -> String,
    private val prep: PrepTimes,
    /** The app's: a call's save outlives its screen, so leaving while its feedback is written keeps the result. */
    private val scope: CoroutineScope,
) : ViewModel() {
    val conversation = store.conversation(conversationId)

    /** When the learner started preparing this task's card, on this device; null before. */
    val prepStartedAt: Flow<Long?> = prep.startedAt(conversationId)

    /** A new card or mock being written for another try; the screen opens it once started. */
    var startingAgain by mutableStateOf(false)
        private set

    /** Null on the intro, before a start. */
    var call by mutableStateOf<LiveCall?>(null)
        private set

    var usedHelp by mutableStateOf(false)
        private set

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
        call?.leave()
        usedHelp = false
        save = null
        val next = newCall(conversation.script)
        call = next
        next.start(microphone, takeover)
        // The notification's Hang up does what End does: a call that hasn't connected goes back to its intro.
        ongoing.keep(next, conversation.character.name) {
            if (next.state.value.phase == LiveCallPhase.Connecting) showIntro() else next.hangUp()
        }
        // A dropped call the learner then ends is saved too.
        viewModelScope.launch {
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

    /** Back to the intro, as ending a call that hasn't connected does. */
    fun showIntro() {
        call?.leave()
        call = null
        usedHelp = false
        save = null
    }

    fun help() {
        usedHelp = true
    }

    fun startPrep() {
        viewModelScope.launch { prep.start(conversationId, System.currentTimeMillis()) }
    }

    /** Another try at a speaking mock or an exam task: a new conversation, written on the learner's tap. */
    fun startAgain(
        request: CallRequest,
        onStarted: (UUID) -> Unit,
    ) {
        if (startingAgain) return
        startingAgain = true
        viewModelScope.launch {
            val started = store.start(request)
            startingAgain = false
            if (started is CallStart.Started) onStarted(started.conversationId)
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
        val input = LanguageConversationCompletionInput(summary.connectionId, summary.spokenSeconds, summary.turns, usedHelp, timeZone())
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

val LanguageConversation.script: LiveCallScript
    get() =
        LiveCallScript(
            openingLine = openingLine,
            objectives = objectives.map { it.label },
            met = objectives.filter { it.met }.map { it.label },
            minutes = minutes,
            examCues = examTask?.cues,
        )

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
