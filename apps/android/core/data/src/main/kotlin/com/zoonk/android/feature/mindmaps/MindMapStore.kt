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
import com.zoonk.android.data.hasContent
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.android.data.withBearer
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.ui.components.Limit
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
    data object Ready : MindMapCreated

    /** [shown] is writing the chapter's lessons first, or drawing. */
    data class OnItsWay(
        val shown: MindMapShown,
    ) : MindMapCreated

    /** The chapter has no map: a language's unit, or nothing in its outline to draw from. */
    data object Unavailable : MindMapCreated

    /** The chapter's lessons, and so its map, are Plus-only for this learner. */
    data object PlusRequired : MindMapCreated

    /** [lessonsRanOut]: what ran out was the lessons the map would write first, not the maps. */
    data class Refused(
        val limit: Limit,
        val lessonsRanOut: Boolean,
    ) : MindMapCreated

    data object Failed : MindMapCreated
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

    /**
     * Null when the session changed meanwhile. A map on its way shows so in the reads kept of it, so
     * a screen opened again follows it; one already drawn, or locked for Plus, is read again.
     */
    suspend fun create(key: ChapterKey): MindMapCreated? =
        when (val result = cache.mutate(invalidating = setOf(DataDomain.Allowance)) { api.create(it, key) }) {
            is MutationResult.Done -> {
                val shown = result.value.status.shown
                if (shown == MindMapShown.Ready) {
                    readAgain(key)
                    MindMapCreated.Ready
                } else {
                    onItsWay(key, shown)
                    MindMapCreated.OnItsWay(shown)
                }
            }

            is MutationResult.Failed -> {
                refused(result, key)
            }

            MutationResult.Obsolete -> {
                null
            }
        }

    private fun refused(
        result: MutationResult.Failed,
        key: ChapterKey,
    ): MindMapCreated {
        if (result.code == PLUS_REQUIRED) {
            readAgain(key)
            return MindMapCreated.PlusRequired
        }
        val limit = Limit.of(result)
        return when {
            limit != null -> MindMapCreated.Refused(limit, lessonsRanOut = result.details.ranOut() in LESSON_RESOURCES)
            result.status == UNPROCESSABLE -> MindMapCreated.Unavailable
            else -> MindMapCreated.Failed
        }
    }

    private fun readAgain(key: ChapterKey) {
        list[key.goalId].invalidate()
        chapter[key].invalidate()
    }

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
     * Reads the map again wherever a read of it is kept (the others when next shown) and says whether
     * those reads now show [status]; false when one couldn't be read, which the poll counts as a miss.
     */
    suspend fun reread(
        key: ChapterKey,
        status: MindMapShown,
    ): Boolean {
        val list = list[key.goalId]
        val chapter = chapter[key]
        listOf(list, chapter).forEach { if (it.state.value.hasContent) it.refresh() else it.invalidate() }

        val listed =
            list.state.value.value
                ?.chapters
                ?.firstOrNull { it.chapterId == key.chapterId }
        val read = chapter.state.value.value
        return listOfNotNull(listed?.status?.shown, read?.status?.shown).all { it == status }
    }

    private fun onItsWay(
        key: ChapterKey,
        shown: MindMapShown,
    ) {
        val writing = shown == MindMapShown.WritingLessons
        val listed = if (writing) GoalMindMap.Status.WRITING_LESSONS else GoalMindMap.Status.DRAWING
        list[key.goalId].update { maps ->
            maps.copy(chapters = maps.chapters.map { if (it.chapterId == key.chapterId) it.copy(status = listed) else it })
        }
        chapter[key].update { it.copy(status = if (writing) ChapterMindMap.Status.WRITING_LESSONS else ChapterMindMap.Status.DRAWING) }
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
        val DOMAINS = setOf(DataDomain.Goals, DataDomain.UserProgress)
        const val UNPROCESSABLE = 422
        const val PLUS_REQUIRED = "PLUS_REQUIRED"
        val LESSON_RESOURCES = setOf("lessonStart", "generatedLessons")
    }
}

/** A refusal's `details.limit.resource`: what ran out. */
private fun JsonElement?.ranOut(): String? =
    (((this as? JsonObject)?.get("limit") as? JsonObject)?.get("resource") as? JsonPrimitive)?.contentOrNull
