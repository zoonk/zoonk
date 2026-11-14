package com.zoonk.android.feature.speaking

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.perform
import com.zoonk.api.models.SpeakingPaper
import java.util.UUID

/** A goal's speaking paper, or none: a goal that isn't a language's practices on its exam page. */
sealed interface SpeakingRead {
    data class Paper(
        val paper: SpeakingPaper,
    ) : SpeakingRead

    data object NotLanguage : SpeakingRead
}

fun interface SpeakingApi {
    suspend fun paper(
        session: AuthenticatedSession?,
        goalId: UUID,
    ): SpeakingRead?
}

class LiveSpeakingApi(
    private val api: ApiClients,
) : SpeakingApi {
    override suspend fun paper(
        session: AuthenticatedSession?,
        goalId: UUID,
    ): SpeakingRead? =
        try {
            SpeakingRead.Paper(perform { api.clients(session).language.getSpeakingPaper(goalId) })
        } catch (e: ApiException) {
            if (e.status == UNPROCESSABLE) SpeakingRead.NotLanguage else throw e
        }

    private companion object {
        const val UNPROCESSABLE = 422
    }
}

/** Each task's last try changes with every call saved, so the paper reads progress. */
class SpeakingStore(
    api: SpeakingApi,
    cache: AppCache,
) {
    private val papers =
        cache.keyed<UUID, SpeakingRead>(Audience.SignedIn, setOf(DataDomain.UserProgress, DataDomain.UserSubscription)) { session, goalId ->
            api.paper(session, goalId)
        }

    fun paper(goalId: UUID) = papers[goalId]

    /**
     * The server refused a start because it needs a subscription: that answer is the access now, so a
     * read that fails after it keeps the gate, and the next read that succeeds (a purchase) replaces it.
     */
    suspend fun refused(goalId: UUID) {
        val resource = papers[goalId]
        resource.update { read -> (read as? SpeakingRead.Paper)?.let { SpeakingRead.Paper(it.paper.locked()) } ?: read }
        resource.refresh()
    }
}

/** A paper whose tasks need a subscription. */
fun SpeakingPaper.locked(): SpeakingPaper = copy(access = SpeakingPaper.Access.PLUS_REQUIRED)
