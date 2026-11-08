package com.zoonk.android.feature.mindmaps

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.data.Resource
import com.zoonk.android.data.hasContent
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.android.data.withBearer
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.ChapterMindMapStatus
import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.GoalMindMaps
import com.zoonk.api.models.MindMapGeneration
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import java.io.IOException
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

interface MindMapApi {
    suspend fun list(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalMindMaps

    suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): ChapterMindMap

    suspend fun create(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): MindMapGeneration

    suspend fun status(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): ChapterMindMapStatus.Status

    /** The picture's file as stored; only the API's own files get the session's bearer. */
    suspend fun picture(
        session: AuthenticatedSession,
        url: String,
    ): ByteArray
}

class LiveMindMapApi(
    private val api: ApiClients,
    private val images: PrivateImages,
) : MindMapApi {
    override suspend fun list(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).learner.listGoalMindMaps(goalId) }

    override suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ) = perform { api.clients(session).learner.getChapterMindMap(key.goalId, key.chapterId) }

    override suspend fun create(
        session: AuthenticatedSession,
        key: ChapterKey,
    ) = perform { api.clients(session).learner.createChapterMindMapGeneration(key.goalId, key.chapterId) }

    override suspend fun status(
        session: AuthenticatedSession,
        key: ChapterKey,
    ) = perform { api.clients(session).learner.getChapterMindMapStatus(key.goalId, key.chapterId) }.status

    override suspend fun picture(
        session: AuthenticatedSession,
        url: String,
    ): ByteArray {
        val parsed = url.toHttpUrlOrNull() ?: throw ApiException(ApiError.NotFound)
        val client = if (images.isPrivate(parsed)) api.http.withBearer(session.bearerToken) else api.http
        return withContext(Dispatchers.IO) {
            try {
                client.newCall(Request.Builder().url(parsed).build()).execute().use { response ->
                    if (!response.isSuccessful) throw ApiException(ApiError.Unavailable, status = response.code)
                    response.body.bytes()
                }
            } catch (e: IOException) {
                throw ApiException(ApiError.Network)
            }
        }
    }
}

sealed interface MindMapCreated {
    /** Started, joined, already drawn, locked for Plus or without a map: the reads, read again, say which. */
    data object Read : MindMapCreated

    /** [subject]: what ran out, the maps, the lessons the map would write first, or the day's AI help. */
    data class Refused(
        val limit: Limit,
        val subject: LimitSubject,
    ) : MindMapCreated

    /** The request, or the reads after it, didn't come through. */
    data object Unreachable : MindMapCreated
}

/** A goal's mind maps, and making one: a model call, so only from a learner's tap. */
class MindMapStore(
    private val api: MindMapApi,
    private val cache: AppCache,
) {
    val list: KeyedResources<UUID, GoalMindMaps> =
        cache.keyed(Audience.SignedIn, DOMAINS) { session, goalId -> session?.let { api.list(it, goalId) } }

    val chapter: KeyedResources<ChapterKey, ChapterMindMap> =
        cache.keyed(Audience.SignedIn, DOMAINS) { session, key -> session?.let { api.chapter(it, key) } }

    /** Null when the session changed meanwhile. The reads say what came of it; nothing is written into them. */
    suspend fun create(key: ChapterKey): MindMapCreated? =
        when (val result = cache.mutate(invalidating = setOf(DataDomain.Allowance)) { api.create(it, key) }) {
            is MutationResult.Done -> readAgain(key)
            is MutationResult.Failed -> refused(result, key)
            MutationResult.Obsolete -> null
        }

    private suspend fun refused(
        result: MutationResult.Failed,
        key: ChapterKey,
    ): MindMapCreated {
        val limit = Limit.of(result)
        return when {
            result.code == PLUS_REQUIRED || result.status == UNPROCESSABLE -> readAgain(key)
            limit != null -> MindMapCreated.Refused(limit, result.details.ranOut().limitSubject)
            else -> MindMapCreated.Unreachable
        }
    }

    private suspend fun readAgain(key: ChapterKey) = if (refresh(key)) MindMapCreated.Read else MindMapCreated.Unreachable

    /** Null when it couldn't be read; the poll counts those. */
    suspend fun status(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): ChapterMindMapStatus.Status? =
        try {
            api.status(session, key)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }

    /**
     * Whether the reads kept of the map show [status], reading them again first when they don't;
     * false when they still don't or a read didn't come through, which the poll counts as a miss.
     */
    suspend fun agrees(
        key: ChapterKey,
        status: MindMapShown,
    ): Boolean = shows(key, status) || (refresh(key) && shows(key, status))

    private fun shows(
        key: ChapterKey,
        status: MindMapShown,
    ): Boolean {
        val listed =
            list[key.goalId]
                .state.value.value
                ?.chapters
                ?.firstOrNull { it.chapterId == key.chapterId }
        val read = chapter[key].state.value.value
        return listOfNotNull(listed?.status?.shown, read?.status?.shown).all { it == status }
    }

    /** Reads the map again wherever a read of it is kept (the others load fresh when shown); false when one didn't come through. */
    private suspend fun refresh(key: ChapterKey): Boolean = listOf(list[key.goalId], chapter[key]).map { it.reread() }.all { it }

    private suspend fun Resource<*>.reread(): Boolean {
        if (!state.value.hasContent) {
            invalidate()
            return true
        }
        val before = revision
        refresh()
        return revision != before
    }

    suspend fun picture(
        session: AuthenticatedSession,
        url: String,
    ): ByteArray? =
        try {
            api.picture(session, url)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }

    private companion object {
        // Buying Plus unlocks the chapters past the free week.
        val DOMAINS = setOf(DataDomain.Goals, DataDomain.UserProgress, DataDomain.UserSubscription)
        const val UNPROCESSABLE = 422
        const val PLUS_REQUIRED = "PLUS_REQUIRED"
    }
}

/** Main's wording for what ran out: lessons for the lessons a map writes first, help for the day's AI spend. */
private val String?.limitSubject: LimitSubject
    get() =
        when (this) {
            "lessonStart", "generatedLessons" -> LimitSubject.Lessons
            "aiSpend" -> LimitSubject.Help
            else -> LimitSubject.MindMaps
        }

/** A refusal's `details.limit.resource`: what ran out. */
private fun JsonElement?.ranOut(): String? =
    (((this as? JsonObject)?.get("limit") as? JsonObject)?.get("resource") as? JsonPrimitive)?.contentOrNull
