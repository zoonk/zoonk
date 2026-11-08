package com.zoonk.android.feature.warmup

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.perform
import com.zoonk.api.models.WarmUpDeck
import java.util.UUID
import kotlin.time.Duration

fun interface WarmUpApi {
    suspend fun deck(
        session: AuthenticatedSession,
        warmUpId: String,
    ): WarmUpDeck
}

class LiveWarmUpApi(
    private val api: ApiClients,
) : WarmUpApi {
    override suspend fun deck(
        session: AuthenticatedSession,
        warmUpId: String,
    ) = perform { api.clients(session).warmUps.getWarmUp(UUID.fromString(warmUpId)) }
}

/**
 * The shared decks of quick guesses a wait shows under its timeline, and how far each learner got in
 * each one while the app runs, so the first lesson's wait goes on from the plan's.
 */
class WarmUpStore(
    api: WarmUpApi,
    cache: AppCache,
    private val sessions: SessionSource,
) {
    /** A ready deck never changes. */
    val decks =
        cache.keyed<String, WarmUpDeck>(Audience.SignedIn, maxAge = Duration.INFINITE, isEmpty = { it.cards.isEmpty() }) { session, id ->
            session?.let { api.deck(it, id) }
        }

    private val places = mutableMapOf<Pair<String, String>, Int>()
    private val shown = mutableSetOf<Pair<String, String>>()

    fun claimShown(warmUpId: String): Boolean = place(warmUpId)?.let(shown::add) ?: false

    /** The card after the furthest one the current learner answered. */
    fun next(warmUpId: String): Int = place(warmUpId)?.let(places::get) ?: 0

    fun answered(
        warmUpId: String,
        index: Int,
    ) {
        val place = place(warmUpId) ?: return
        places[place] = maxOf(places[place] ?: 0, index + 1)
    }

    private fun place(warmUpId: String) = sessions.current?.let { it.localId to warmUpId }
}
