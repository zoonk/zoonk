package com.zoonk.android.feature.conversation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.feature.livecall.LiveCall
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.livecall.LiveCallScript
import com.zoonk.android.feature.livecall.OngoingCalls
import com.zoonk.api.models.CompletedLanguageConversation
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
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
) : ViewModel() {
    val conversation = store.conversation(conversationId)

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
        ongoing.keep(next, conversation.character.name)
        viewModelScope.launch {
            val phase = next.state.first { it.phase == LiveCallPhase.Ended || it.phase == LiveCallPhase.Failed }.phase
            if (phase == LiveCallPhase.Ended && call === next) save(next)
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

    fun saveAgain() {
        val current = call ?: return
        viewModelScope.launch { save(current) }
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
