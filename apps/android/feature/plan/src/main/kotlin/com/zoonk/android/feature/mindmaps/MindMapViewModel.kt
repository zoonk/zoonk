package com.zoonk.android.feature.mindmaps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.goalcontent.ChapterKey
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

enum class PictureSave { Saved, Failed }

/**
 * A screen's mind maps for one session: making one only from a tap, following one while it's on its
 * way (every 4 seconds while drawing, every 15 while its lessons are written, giving up after three
 * misses in a row; the server fails a run that stops reporting), and saving a picture where the
 * learner chose.
 */
class MindMapViewModel(
    private val store: MindMapStore,
    private val session: AuthenticatedSession,
    private val goalId: UUID,
    private val currentSession: () -> AuthenticatedSession?,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : ViewModel() {
    private val locals = MutableStateFlow<Map<UUID, MindMapLocal>>(emptyMap())
    val requests: StateFlow<Map<UUID, MindMapLocal>> = locals.asStateFlow()

    private val stopWatching =
        store.watchReads(goalId) { chapterIds, started ->
            locals.update { all -> all.filterNot { (id, local) -> id in chapterIds && !local.pending && local.since < started } }
        }

    private val saved = MutableStateFlow<PictureSave?>(null)
    val save: StateFlow<PictureSave?> = saved.asStateFlow()

    /** Create and Try again. */
    fun create(chapterId: UUID) {
        if (locals.value[chapterId]?.pending == true) return
        locals.update { it + (chapterId to MindMapLocal(pending = true)) }

        viewModelScope.launch {
            val local =
                when (val created = store.create(ChapterKey(goalId, chapterId))) {
                    null, MindMapCreated.Read -> null
                    MindMapCreated.Unreachable -> MindMapLocal(unreachable = true, since = store.readMark())
                    is MindMapCreated.Refused -> MindMapLocal(limit = created.limit, subject = created.subject, since = store.readMark())
                }
            locals.update { if (local == null) it - chapterId else it + (chapterId to local) }
        }
    }

    /**
     * Runs while the screen shows the map on its way ([shown]): asks where the run stands, reads the
     * map again whenever the reads show otherwise, and ends once they show it ended. It never writes
     * what a status said, since an answer can land after a newer read (Plus bought meanwhile). A
     * status or a read that fails, or reads that still disagree, count as a miss; three in a row say
     * the server is out of reach.
     */
    suspend fun follow(
        chapterId: UUID,
        shown: MindMapShown,
    ) {
        val key = ChapterKey(goalId, chapterId)
        var waiting = shown
        var misses = 0

        while (true) {
            delay(waiting.pollEvery)
            val status = store.status(session, key)?.shown

            if (status != null && store.agrees(key, status)) {
                if (!status.onItsWay) return
                waiting = status
                misses = 0
            } else if (++misses >= MAX_MISSES) {
                locals.update { it + (chapterId to MindMapLocal(unreachable = true, since = store.readMark())) }
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

    override fun onCleared() = stopWatching()

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
        const val MAX_MISSES = 3
    }
}
