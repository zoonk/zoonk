package com.zoonk.android.feature.player

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
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
    val today: () -> LocalDate = LocalDate::now,
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

/**
 * An open screen's "I can't talk now" and "I can't listen now", read once from [choices] as it opens.
 * Until [isRead], the screen plays no sound on its own, so a sentence the learner chose not to hear
 * stays quiet.
 */
@Stable
class DayChoices(
    private val choices: TodayChoices,
) {
    private var talkDay by mutableStateOf<LocalDate?>(null)
    private var listenDay by mutableStateOf<LocalDate?>(null)

    var isRead by mutableStateOf(false)
        private set

    val cantTalk: Boolean get() = talkDay == choices.today()

    val cantListen: Boolean get() = listenDay == choices.today()

    /** A learner without a session has chosen nothing. */
    fun read(
        session: AuthenticatedSession?,
        scope: CoroutineScope,
    ) {
        isRead = false
        scope.launch {
            talkDay = choices.today().takeIf { session != null && choices.isChosen(session, TodayChoice.CantTalk) }
            listenDay = choices.today().takeIf { session != null && choices.isChosen(session, TodayChoice.CantListen) }
            isRead = true
        }
    }

    fun setCantTalk(
        chosen: Boolean,
        session: AuthenticatedSession?,
        scope: CoroutineScope,
    ) {
        talkDay = choices.today().takeIf { chosen }
        session?.let { scope.launch { choices.set(it, TodayChoice.CantTalk, chosen) } }
    }

    fun setCantListen(
        chosen: Boolean,
        session: AuthenticatedSession?,
        scope: CoroutineScope,
    ) {
        listenDay = choices.today().takeIf { chosen }
        session?.let { scope.launch { choices.set(it, TodayChoice.CantListen, chosen) } }
    }
}
