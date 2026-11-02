package com.zoonk.android.feature.mindmaps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.api.models.ChapterMindMapStatus
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream
import java.util.UUID
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

enum class PictureSave { Saved, Failed }

/**
 * A screen's mind maps for one session: making one only from a tap, following one while it's drawn
 * (main's 4-second poll, which gives up after three misses in a row or ten minutes), and saving a
 * picture where the learner chose.
 */
class MindMapViewModel(
    private val store: MindMapStore,
    private val session: AuthenticatedSession,
    private val goalId: UUID,
    private val currentSession: () -> AuthenticatedSession?,
    private val pollEvery: Duration = POLL_EVERY,
    private val timeSource: TimeSource = TimeSource.Monotonic,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : ViewModel() {
    private val locals = MutableStateFlow<Map<UUID, MindMapLocal>>(emptyMap())
    val requests: StateFlow<Map<UUID, MindMapLocal>> = locals.asStateFlow()

    private val saved = MutableStateFlow<PictureSave?>(null)
    val save: StateFlow<PictureSave?> = saved.asStateFlow()

    fun create(chapterId: UUID) {
        if (locals.value[chapterId]?.pending == true) return
        locals.update { it + (chapterId to MindMapLocal(pending = true)) }

        viewModelScope.launch {
            val key = ChapterKey(goalId, chapterId)
            val created = store.create(key)
            val local =
                when (created) {
                    null -> MindMapLocal()
                    MindMapCreated.Ready -> MindMapLocal(shown = MindMapShown.Ready)
                    MindMapCreated.Generating -> MindMapLocal(shown = MindMapShown.Generating)
                    MindMapCreated.Unavailable -> MindMapLocal(shown = MindMapShown.Unavailable)
                    MindMapCreated.Failed -> MindMapLocal(shown = MindMapShown.Unreachable)
                    is MindMapCreated.Refused -> MindMapLocal(shown = MindMapShown.Refused, limit = created.limit)
                }
            locals.update { it + (chapterId to local) }
        }
    }

    /** Try again: follows the map again after the poll got stuck, otherwise asks for it again. */
    fun retry(chapterId: UUID) {
        if (locals.value[chapterId]?.stuck == true) {
            locals.update { it + (chapterId to MindMapLocal(shown = MindMapShown.Generating)) }
        } else {
            create(chapterId)
        }
    }

    /**
     * Runs while the screen shows the map being drawn, until the screen's reads show how it ended; a
     * status or a read that fails counts as a miss. The server ends a drawing that stalls.
     */
    suspend fun follow(chapterId: UUID) {
        val key = ChapterKey(goalId, chapterId)
        val started = timeSource.markNow()
        var misses = 0

        while (true) {
            delay(pollEvery)
            val status = store.status(session, key)

            when {
                status == null -> {
                    misses++
                }

                status == ChapterMindMapStatus.Status.GENERATING -> {
                    misses = 0
                }

                else -> {
                    locals.update { it + (chapterId to MindMapLocal(shown = status.shown)) }
                    if (store.reread(key, status.shown)) return
                    misses++
                }
            }

            if (misses >= MAX_MISSES || started.elapsedNow() >= GIVE_UP_AFTER) {
                locals.update { it + (chapterId to MindMapLocal(stuck = true)) }
                return
            }
        }
    }

    /** Writes only for the session that asked, and says nothing once it ended. */
    fun savePicture(
        url: String,
        open: () -> OutputStream?,
    ) {
        viewModelScope.launch {
            val bytes = store.picture(session, url)
            if (!isCurrent) return@launch
            val written = bytes != null && withContext(io) { isCurrent && write(open, bytes) }
            if (isCurrent) saved.value = if (written) PictureSave.Saved else PictureSave.Failed
        }
    }

    private val isCurrent get() = currentSession() == session

    fun savedShown() {
        saved.value = null
    }

    private fun write(
        open: () -> OutputStream?,
        bytes: ByteArray,
    ): Boolean =
        try {
            open()?.use { it.write(bytes) } != null
        } catch (e: IOException) {
            false
        } catch (e: SecurityException) {
            false
        }

    private companion object {
        val POLL_EVERY = 4.seconds
        val GIVE_UP_AFTER = 10.minutes
        const val MAX_MISSES = 3
    }
}

private val ChapterMindMapStatus.Status.shown: MindMapShown
    get() =
        when (this) {
            ChapterMindMapStatus.Status.UNAVAILABLE -> MindMapShown.Unavailable
            ChapterMindMapStatus.Status.AVAILABLE -> MindMapShown.Available
            ChapterMindMapStatus.Status.GENERATING -> MindMapShown.Generating
            ChapterMindMapStatus.Status.READY -> MindMapShown.Ready
            ChapterMindMapStatus.Status.FAILED -> MindMapShown.Failed
        }
