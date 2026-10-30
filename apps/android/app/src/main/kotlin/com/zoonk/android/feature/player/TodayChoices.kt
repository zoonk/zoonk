package com.zoonk.android.feature.player

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import java.time.LocalDate

enum class TodayChoice { CantWrite, CantTalk, CantListen }

@Serializable
private data class ChosenOn(
    val cantWrite: String? = null,
    val cantTalk: String? = null,
    val cantListen: String? = null,
)

/**
 * "Can't write now", "I can't talk now" and "I can't listen now" last the rest of the learner's day
 * on this device, and survive the app closing; each account keeps its own.
 */
class TodayChoices(
    private val drafts: DraftStore,
    private val today: () -> LocalDate = LocalDate::now,
) {
    suspend fun isChosen(
        session: AuthenticatedSession,
        choice: TodayChoice,
    ): Boolean {
        val chosen = handle(session).value.first() ?: return false
        return chosen.on(choice) == today().toString()
    }

    suspend fun set(
        session: AuthenticatedSession,
        choice: TodayChoice,
        chosen: Boolean,
    ) {
        val handle = handle(session)
        val day = today().toString().takeIf { chosen }
        val current = handle.value.first() ?: ChosenOn()
        handle.save(
            when (choice) {
                TodayChoice.CantWrite -> current.copy(cantWrite = day)
                TodayChoice.CantTalk -> current.copy(cantTalk = day)
                TodayChoice.CantListen -> current.copy(cantListen = day)
            },
        )
    }

    private fun handle(session: AuthenticatedSession) = drafts.open(session, KEY, ChosenOn.serializer())

    private fun ChosenOn.on(choice: TodayChoice) =
        when (choice) {
            TodayChoice.CantWrite -> cantWrite
            TodayChoice.CantTalk -> cantTalk
            TodayChoice.CantListen -> cantListen
        }

    private companion object {
        const val KEY = "player.todayChoices"
    }
}
