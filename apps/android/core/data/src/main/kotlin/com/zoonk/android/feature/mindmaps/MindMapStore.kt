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

    data object Generating : MindMapCreated

    /** Maps are for chapters the learner finished. */
    data object Unavailable : MindMapCreated

    data class Refused(
        val limit: Limit,
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
     * Null when the session changed meanwhile. A map being drawn shows as drawing in the reads kept
     * of it, so a screen opened again follows it; one already drawn is read again.
     */
    suspend fun create(key: ChapterKey): MindMapCreated? =
        when (val result = cache.mutate(invalidating = setOf(DataDomain.Allowance)) { api.create(it, key) }) {
            is MutationResult.Done -> {
                if (result.value.status == MindMapGeneration.Status.READY) {
                    list[key.goalId].invalidate()
                    chapter[key].invalidate()
                    MindMapCreated.Ready
                } else {
                    drawing(key)
                    MindMapCreated.Generating
                }
            }

            is MutationResult.Failed -> {
                Limit.of(result)?.let(MindMapCreated::Refused)
                    ?: if (result.status == UNPROCESSABLE) MindMapCreated.Unavailable else MindMapCreated.Failed
            }

            MutationResult.Obsolete -> {
                null
            }
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

    private fun drawing(key: ChapterKey) {
        list[key.goalId].update { maps -> maps.copy(chapters = maps.chapters.map { it.drawingIf(key.chapterId) }) }
        chapter[key].update { it.copy(status = ChapterMindMap.Status.GENERATING) }
    }

    private fun GoalMindMap.drawingIf(id: UUID) = if (chapterId == id) copy(status = GoalMindMap.Status.GENERATING) else this

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
    }
}
