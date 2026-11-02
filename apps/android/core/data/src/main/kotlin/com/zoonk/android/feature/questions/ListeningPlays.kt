package com.zoonk.android.feature.questions

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/** A recording's plays on this device: [played] counted, [playing] while one runs, and the one restart practice gives back. */
@Serializable
data class PlaysState(
    val played: Int = 0,
    val playing: Boolean = false,
    val restart: Restart = Restart.None,
) {
    enum class Restart { None, Given, Used }
}

/**
 * Main's `useListeningPlays`: a recording's plays kept on the device, so leaving or a closed app
 * never gives one back, except a practice's one cut-off play, given back once. Exam fidelity, not
 * security: the file is public.
 */
class ListeningPlays(
    private val drafts: DraftStore,
    private val scope: CoroutineScope,
) {
    fun state(
        session: AuthenticatedSession,
        key: String,
    ): Flow<PlaysState> = handle(session, key).value.map { it ?: PlaysState() }

    fun started(
        session: AuthenticatedSession,
        key: String,
    ) = update(session, key) {
        PlaysState(
            played = it.played + 1,
            playing = true,
            restart =
                if (it.restart ==
                    PlaysState.Restart.Given
                ) {
                    PlaysState.Restart.Used
                } else {
                    it.restart
                },
        )
    }

    fun ended(
        session: AuthenticatedSession,
        key: String,
    ) = update(session, key) { it.copy(playing = false) }

    /** A play under way as the recording shows again was cut off too. */
    fun interrupted(
        session: AuthenticatedSession,
        key: String,
        restartOnce: Boolean,
    ) = update(session, key) {
        when {
            !it.playing -> {
                it
            }

            restartOnce && it.restart == PlaysState.Restart.None -> {
                PlaysState(
                    played = it.played - 1,
                    playing = false,
                    restart = PlaysState.Restart.Given,
                )
            }

            else -> {
                it.copy(playing = false)
            }
        }
    }

    private fun update(
        session: AuthenticatedSession,
        key: String,
        change: (PlaysState) -> PlaysState,
    ) {
        scope.launch {
            val handle = handle(session, key)
            val state = handle.value.first() ?: PlaysState()
            val next = change(state)
            if (next != state) handle.save(next)
        }
    }

    private fun handle(
        session: AuthenticatedSession,
        key: String,
    ) = drafts.open(session, "listening:$key", PlaysState.serializer())
}
